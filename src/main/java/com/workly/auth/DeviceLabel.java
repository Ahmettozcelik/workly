package com.workly.auth;

/**
 * A coarse, human-readable device for the session list ("Chrome · Windows"),
 * taken from the User-Agent at sign-in. Only this label is stored in the
 * session, never the User-Agent itself or the address (data minimisation).
 * Null when nothing is recognised; the frontend then shows "unknown device".
 */
final class DeviceLabel {

	private static final int MAX_USER_AGENT_LENGTH = 512;

	private DeviceLabel() {
	}

	static String of(String userAgent) {
		if (userAgent == null || userAgent.isBlank()) {
			return null;
		}
		String ua = userAgent.length() > MAX_USER_AGENT_LENGTH ? userAgent.substring(0, MAX_USER_AGENT_LENGTH) : userAgent;
		String browser = browser(ua);
		String system = system(ua);
		if (browser == null && system == null) {
			return null;
		}
		if (browser == null) {
			return system;
		}
		return system == null ? browser : browser + " · " + system;
	}

	// Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
	private static String browser(String ua) {
		if (ua.contains("Edg/") || ua.contains("EdgA/") || ua.contains("EdgiOS/")) {
			return "Edge";
		}
		if (ua.contains("OPR/") || ua.contains("Opera")) {
			return "Opera";
		}
		if (ua.contains("SamsungBrowser/")) {
			return "Samsung Internet";
		}
		if (ua.contains("Firefox/") || ua.contains("FxiOS/")) {
			return "Firefox";
		}
		if (ua.contains("Chrome/") || ua.contains("CriOS/")) {
			return "Chrome";
		}
		if (ua.contains("Safari/") && ua.contains("Version/")) {
			return "Safari";
		}
		return null;
	}

	// Android before Linux, iPhone/iPad before Mac OS X: both say the latter too.
	private static String system(String ua) {
		if (ua.contains("Windows")) {
			return "Windows";
		}
		if (ua.contains("Android")) {
			return "Android";
		}
		if (ua.contains("iPhone") || ua.contains("iPad") || ua.contains("iPod")) {
			return "iOS";
		}
		if (ua.contains("Mac OS X") || ua.contains("Macintosh")) {
			return "macOS";
		}
		if (ua.contains("CrOS")) {
			return "ChromeOS";
		}
		if (ua.contains("Linux")) {
			return "Linux";
		}
		return null;
	}
}
