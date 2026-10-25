package com.workly.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/**
 * The session cookie, defined explicitly. Spring Boot applies the
 * server.servlet.session.cookie.* properties to Spring Session only when it
 * runs an embedded web server; this bean makes the cookie the same everywhere
 * (embedded server, WAR deployment, MockMvc tests).
 */
@Configuration(proxyBeanMethods = false)
class SessionCookieConfig {

	static final String COOKIE_NAME = "WORKLY_SESSION";

	@Bean
	CookieSerializer cookieSerializer(@Value("${workly.session.cookie-secure}") boolean secure) {
		DefaultCookieSerializer serializer = new DefaultCookieSerializer();
		serializer.setCookieName(COOKIE_NAME);
		serializer.setCookiePath("/");
		// Not readable by JavaScript; sent on top-level navigations from other
		// sites (links) but not on their cross-site POSTs.
		serializer.setUseHttpOnlyCookie(true);
		serializer.setSameSite("Lax");
		serializer.setUseSecureCookie(secure);
		return serializer;
	}
}
