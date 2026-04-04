const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
// Đảm bảo đường dẫn này đúng với máy bạn (file tạo token)
const { generateAccessToken, generateRefreshToken } = require("../config/jwt");

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const FACEBOOK_AUTH_URL = "https://www.facebook.com/v20.0/dialog/oauth";
const FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v20.0/oauth/access_token";
const FACEBOOK_USERINFO_URL = "https://graph.facebook.com/me";
const FRONTEND_SOCIAL_CALLBACK_PATH = "/auth/callback";

const normalizeUrl = (value = "") => String(value).trim().replace(/\/+$/, "");

const encodeBase64Url = (value) =>
  Buffer.from(String(value), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const decodeBase64Url = (value = "") => {
  const base64 = String(value)
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(value).length / 4) * 4, "=");
  return Buffer.from(base64, "base64").toString("utf8");
};

const safeRedirectPath = (value = "/") => {
  const path = String(value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
};

const getServerBaseUrl = (req) => {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
};

const buildFrontendCallbackUrl = ({ provider, redirectPath, accessToken, refreshToken, user, error }) => {
  const clientUrl = normalizeUrl(process.env.CLIENT_URL || "http://localhost:3000");
  const callbackUrl = new URL(`${clientUrl}${FRONTEND_SOCIAL_CALLBACK_PATH}`);
  callbackUrl.searchParams.set("provider", provider);
  callbackUrl.searchParams.set("redirect", safeRedirectPath(redirectPath));

  if (error) {
    callbackUrl.searchParams.set("error", error);
    return callbackUrl.toString();
  }

  callbackUrl.searchParams.set("accessToken", accessToken);
  callbackUrl.searchParams.set("refreshToken", refreshToken);
  callbackUrl.searchParams.set(
    "user",
    encodeBase64Url(JSON.stringify({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    }))
  );
  return callbackUrl.toString();
};

const getUniqueUsername = async (name, email) => {
  const rawBase = (name || email?.split("@")[0] || "user")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18);

  const base = rawBase || "user";
  let candidate = base;
  let counter = 1;

  while (await User.exists({ username: candidate })) {
    candidate = `${base}${counter}`;
    counter += 1;
  }

  return candidate;
};

const finalizeSocialAuth = async ({ profile, provider, redirectPath }, res) => {
  if (!profile?.email) {
    const missingEmailUrl = buildFrontendCallbackUrl({
      provider,
      redirectPath,
      error: "Không lấy được email từ nhà cung cấp đăng nhập.",
    });
    return res.redirect(missingEmailUrl);
  }

  let user = await User.findOne({ email: String(profile.email).toLowerCase() });

  if (!user) {
    const username = await getUniqueUsername(profile.name, profile.email);
    const randomPassword = crypto.randomBytes(24).toString("hex");

    user = await User.create({
      username,
      email: String(profile.email).toLowerCase(),
      password: randomPassword,
      role: "user",
      ...(provider === "google" && profile.providerId ? { googleId: profile.providerId } : {}),
      ...(provider === "facebook" && profile.providerId ? { facebookId: profile.providerId } : {}),
      ...(profile.avatar ? { avatar: profile.avatar } : {}),
    });
  } else {
    const patch = {};
    if (provider === "google" && profile.providerId && !user.googleId) patch.googleId = profile.providerId;
    if (provider === "facebook" && profile.providerId && !user.facebookId) patch.facebookId = profile.providerId;
    if (profile.avatar && !user.avatar) patch.avatar = profile.avatar;
    if (Object.keys(patch).length > 0) {
      user.set(patch);
      await user.save({ validateBeforeSave: false });
    }
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const redirectUrl = buildFrontendCallbackUrl({
    provider,
    redirectPath,
    accessToken,
    refreshToken,
    user,
  });

  return res.redirect(redirectUrl);
};

const redirectToSocialError = (res, provider, redirectPath, message) => {
  const errUrl = buildFrontendCallbackUrl({
    provider,
    redirectPath,
    error: message,
  });
  return res.redirect(errUrl);
};

// --- 0. SOCIAL LOGIN (GOOGLE + FACEBOOK) ---
exports.startGoogleAuth = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ message: "Thiếu cấu hình GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET" });
  }

  const redirectPath = safeRedirectPath(req.query.redirect || "/");
  const state = encodeBase64Url(JSON.stringify({ redirectPath }));
  const redirectUri = `${getServerBaseUrl(req)}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });

  return res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
};

exports.handleGoogleCallback = async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  let redirectPath = "/";

  try {
    if (state) {
      const parsed = JSON.parse(decodeBase64Url(state));
      redirectPath = safeRedirectPath(parsed.redirectPath || "/");
    }
  } catch {
    redirectPath = "/";
  }

  if (!code) {
    return redirectToSocialError(res, "google", redirectPath, "Đăng nhập Google thất bại (thiếu code).");
  }

  try {
    const redirectUri = `${getServerBaseUrl(req)}/api/auth/google/callback`;
    const tokenBody = new URLSearchParams({
      code: String(code),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return redirectToSocialError(res, "google", redirectPath, "Không lấy được access token từ Google.");
    }

    const profileRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profileRes.ok) {
      return redirectToSocialError(res, "google", redirectPath, "Không lấy được hồ sơ người dùng Google.");
    }

    return finalizeSocialAuth(
      {
        provider: "google",
        redirectPath,
        profile: {
          providerId: profile.sub,
          email: profile.email,
          name: profile.name,
          avatar: profile.picture,
        },
      },
      res
    );
  } catch (err) {
    console.error("🔥 [GOOGLE CALLBACK EXCEPTION]:", err);
    return redirectToSocialError(res, "google", redirectPath, "Đăng nhập Google thất bại.");
  }
};

exports.startFacebookAuth = (req, res) => {
  if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
    return res.status(500).json({ message: "Thiếu cấu hình FACEBOOK_CLIENT_ID/FACEBOOK_CLIENT_SECRET" });
  }

  const redirectPath = safeRedirectPath(req.query.redirect || "/");
  const state = encodeBase64Url(JSON.stringify({ redirectPath }));
  const redirectUri = `${getServerBaseUrl(req)}/api/auth/facebook/callback`;

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: "email,public_profile",
    response_type: "code",
  });

  return res.redirect(`${FACEBOOK_AUTH_URL}?${params.toString()}`);
};

exports.handleFacebookCallback = async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  let redirectPath = "/";

  try {
    if (state) {
      const parsed = JSON.parse(decodeBase64Url(state));
      redirectPath = safeRedirectPath(parsed.redirectPath || "/");
    }
  } catch {
    redirectPath = "/";
  }

  if (!code) {
    return redirectToSocialError(res, "facebook", redirectPath, "Đăng nhập Facebook thất bại (thiếu code).");
  }

  try {
    const redirectUri = `${getServerBaseUrl(req)}/api/auth/facebook/callback`;
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_CLIENT_ID,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code: String(code),
    });

    const tokenRes = await fetch(`${FACEBOOK_TOKEN_URL}?${tokenParams.toString()}`);
    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok || !tokenJson.access_token) {
      return redirectToSocialError(res, "facebook", redirectPath, "Không lấy được access token từ Facebook.");
    }

    const profileParams = new URLSearchParams({
      fields: "id,name,email,picture.type(large)",
      access_token: tokenJson.access_token,
    });
    const profileRes = await fetch(`${FACEBOOK_USERINFO_URL}?${profileParams.toString()}`);
    const profile = await profileRes.json();

    if (!profileRes.ok) {
      return redirectToSocialError(res, "facebook", redirectPath, "Không lấy được hồ sơ người dùng Facebook.");
    }

    return finalizeSocialAuth(
      {
        provider: "facebook",
        redirectPath,
        profile: {
          providerId: profile.id,
          email: profile.email,
          name: profile.name,
          avatar: profile.picture?.data?.url,
        },
      },
      res
    );
  } catch (err) {
    console.error("🔥 [FACEBOOK CALLBACK EXCEPTION]:", err);
    return redirectToSocialError(res, "facebook", redirectPath, "Đăng nhập Facebook thất bại.");
  }
};

// --- 1. ĐĂNG KÝ (REGISTER) ---
exports.register = async (req, res) => {
  // [DEBUG] Log xem dữ liệu Frontend gửi lên là gì
  console.log("👉 [REGISTER START] Body:", req.body);

  try {
    const { username, email, password } = req.body;

    // 1. Kiểm tra xem user có tồn tại chưa
    const exists = await User.findOne({ email });
    if (exists) {
      console.log("❌ [REGISTER ERROR] Email đã tồn tại:", email);
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    console.log("✅ [REGISTER] Email hợp lệ. Đang tạo User...");

    // 2. Tạo User mới (Mongoose tự mã hóa password)
    const newUser = await User.create({ username, email, password });

    console.log("✅ [REGISTER] User đã tạo xong ID:", newUser._id);

    // 3. Tạo Token
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // 4. Lưu Refresh Token vào DB
    newUser.refreshToken = refreshToken;
    await newUser.save({ validateBeforeSave: false });

    console.log("✅ [REGISTER] Đã lưu Token. Gửi phản hồi...");

    // 5. Trả về kết quả
    newUser.password = undefined; // Ẩn mật khẩu

    res.status(201).json({
      status: "success",
      message: "Đăng ký thành công!",
      accessToken,
      refreshToken,
      data: { user: newUser },
    });

  } catch (err) {
    console.error("🔥 [REGISTER EXCEPTION]:", err); // In lỗi chi tiết ra
    // Xử lý lỗi trùng lặp (E11000)
    if (err.code === 11000) {
        return res.status(400).json({ message: "Tên đăng nhập hoặc Email đã tồn tại" });
    }
    res.status(500).json({ message: err.message });
  }
};

// --- 2. ĐĂNG NHẬP (LOGIN) ---
exports.login = async (req, res) => {
  // [DEBUG] Log dữ liệu đăng nhập
  console.log("👉 [LOGIN START] Body:", req.body);

  try {
    const { email, password } = req.body;

    // 1. Tìm user (lấy cả password đã mã hóa)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      console.log("❌ [LOGIN ERROR] Không tìm thấy Email:", email);
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // 2. So khớp mật khẩu
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log("❌ [LOGIN ERROR] Sai mật khẩu cho:", email);
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }

    console.log("✅ [LOGIN] Mật khẩu đúng. Đang tạo Token...");

    // 3. Tạo Token mới
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 4. Lưu Refresh Token mới
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // 5. Trả về
    user.password = undefined;
    
    res.json({
      status: "success",
      accessToken,
      refreshToken,
      data: {
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        }
      },
    });

  } catch (err) {
    console.error("🔥 [LOGIN EXCEPTION]:", err);
    res.status(500).json({ message: err.message });
  }
};

// --- 3. REFRESH TOKEN ---
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: "Chưa gửi Refresh Token" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    // Check token khớp DB không
    if (!user || user.refreshToken !== refreshToken) {
       return res.status(403).json({ message: "Token không hợp lệ!" });
    }

    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ message: "Token hết hạn hoặc lỗi" });
  }
};

// --- 4. QUÊN MẬT KHẨU ---
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "Email không tồn tại" });

    // Tạo token ngẫu nhiên
    const resetToken = crypto.randomBytes(20).toString("hex");
    
    // Hash token lưu DB
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 phút

    await user.save({ validateBeforeSave: false });

    // Trả token về (Môi trường dev)
    res.status(200).json({
      status: "success",
      message: "Token reset đã được gửi",
      resetToken: resetToken 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 5. ĐẶT LẠI MẬT KHẨU ---
exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: "Token không hợp lệ hoặc hết hạn" });

    // Lưu ý: Frontend cần gửi field là newPassword
    user.password = req.body.newPassword; 
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ status: "success", message: "Đổi mật khẩu thành công!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
