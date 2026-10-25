package com.workly.auth;

import jakarta.servlet.http.Cookie;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/**
 * MockMvc with a cookie jar, used like the frontend uses the API: it keeps the
 * session and XSRF-TOKEN cookies from Set-Cookie headers and echoes the CSRF
 * token in X-XSRF-TOKEN. No test shortcuts (csrf(), with(user())), so CSRF and
 * sessions are exercised for real. Each client has its own address, like a
 * separate device, so the per-address limits of one test do not affect others.
 */
class BrowserClient {

	static final String SESSION_COOKIE = "WORKLY_SESSION";
	static final String CSRF_COOKIE = "XSRF-TOKEN";

	private static final AtomicInteger ADDRESSES = new AtomicInteger();

	private final MockMvc mvc;
	private final String address;
	private final Map<String, String> cookies = new LinkedHashMap<>();

	BrowserClient(MockMvc mvc) {
		this(mvc, nextAddress());
	}

	/** A client at the given address, e.g. a second browser on the same network. */
	BrowserClient(MockMvc mvc, String address) {
		this.mvc = mvc;
		this.address = address;
	}

	/** 10.x.y.z, unique per client in this JVM. */
	static String nextAddress() {
		int n = ADDRESSES.incrementAndGet();
		return "10.%d.%d.%d".formatted((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
	}

	String address() {
		return address;
	}

	ResultActions get(String path) throws Exception {
		return perform(MockMvcRequestBuilders.get(path));
	}

	/** POST with the current CSRF token (fetched first if the jar has none). */
	ResultActions post(String path, String json) throws Exception {
		if (!cookies.containsKey(CSRF_COOKIE)) {
			get("/api/auth/csrf");
		}
		return perform(jsonPost(path, json).header("X-XSRF-TOKEN", cookies.get(CSRF_COOKIE)));
	}

	/** POST that does not send the X-XSRF-TOKEN header. */
	ResultActions postWithoutCsrfHeader(String path, String json) throws Exception {
		return perform(jsonPost(path, json));
	}

	String cookie(String name) {
		return cookies.get(name);
	}

	void setCookie(String name, String value) {
		cookies.put(name, value);
	}

	private static MockHttpServletRequestBuilder jsonPost(String path, String json) {
		return MockMvcRequestBuilders.post(path).contentType(MediaType.APPLICATION_JSON).content(json);
	}

	private ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
		request.with(each -> {
			each.setRemoteAddr(address);
			return each;
		});
		if (!cookies.isEmpty()) {
			request.cookie(cookies.entrySet().stream()
				.map(entry -> new Cookie(entry.getKey(), entry.getValue()))
				.toArray(Cookie[]::new));
		}
		ResultActions result = mvc.perform(request);
		for (String header : result.andReturn().getResponse().getHeaders(HttpHeaders.SET_COOKIE)) {
			String[] nameValue = header.split(";", 2)[0].split("=", 2);
			if (header.contains("Max-Age=0") || nameValue[1].isEmpty()) {
				cookies.remove(nameValue[0]);
			}
			else {
				cookies.put(nameValue[0], nameValue[1]);
			}
		}
		return result;
	}
}
