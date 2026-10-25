package com.workly.web;

import com.workly.auth.EmailAlreadyRegisteredException;
import com.workly.auth.InvalidVerificationTokenException;
import com.workly.auth.RateLimitedException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Maps exceptions to {@link ApiError} responses. Nothing internal reaches the client. */
@RestControllerAdvice
class ApiExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

	/** When a field breaks several rules, report the most basic one first. */
	private static final List<String> CODE_PRIORITY =
			List.of("REQUIRED", "INVALID_EMAIL", "INVALID_LOCALE", "TOO_SHORT", "TOO_LONG");

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiError.Body> validation(MethodArgumentNotValidException ex) {
		Map<String, String> byField = new LinkedHashMap<>();
		ex.getBindingResult().getFieldErrors().stream()
			.sorted(Comparator.comparing(org.springframework.validation.FieldError::getField)
				.thenComparing(error -> priority(error.getDefaultMessage())))
			.forEach(error -> byField.putIfAbsent(error.getField(), error.getDefaultMessage()));
		List<ApiError.FieldError> errors = byField.entrySet().stream()
			.map(entry -> new ApiError.FieldError(entry.getKey(), entry.getValue()))
			.toList();
		return ApiError.VALIDATION_FAILED.toResponse(errors);
	}

	private static int priority(String code) {
		int index = CODE_PRIORITY.indexOf(code);
		return index < 0 ? CODE_PRIORITY.size() : index;
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	ResponseEntity<ApiError.Body> malformed() {
		return ApiError.MALFORMED_REQUEST.toResponse();
	}

	@ExceptionHandler(EmailAlreadyRegisteredException.class)
	ResponseEntity<ApiError.Body> emailTaken() {
		return ApiError.EMAIL_TAKEN.toResponse();
	}

	@ExceptionHandler(InvalidVerificationTokenException.class)
	ResponseEntity<ApiError.Body> invalidVerificationToken() {
		return ApiError.VERIFICATION_TOKEN_INVALID.toResponse();
	}

	/** Too many attempts. Retry-After: whole seconds until the client may try again (at least 1). */
	@ExceptionHandler(RateLimitedException.class)
	ResponseEntity<ApiError.Body> rateLimited(RateLimitedException ex) {
		long seconds = Math.max(1, (ex.retryAfter().toMillis() + 999) / 1000);
		ResponseEntity<ApiError.Body> response = ApiError.RATE_LIMITED.toResponse();
		return ResponseEntity.status(response.getStatusCode())
			.headers(response.getHeaders())
			.header(HttpHeaders.RETRY_AFTER, Long.toString(seconds))
			.body(response.getBody());
	}

	/** Failed sign-in: one generic answer for unknown email and wrong password. */
	@ExceptionHandler(AuthenticationException.class)
	ResponseEntity<ApiError.Body> invalidCredentials() {
		return ApiError.INVALID_CREDENTIALS.toResponse();
	}

	@ExceptionHandler(NoResourceFoundException.class)
	ResponseEntity<ApiError.Body> notFound() {
		return ApiError.NOT_FOUND.toResponse();
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	ResponseEntity<ApiError.Body> methodNotAllowed() {
		return ApiError.METHOD_NOT_ALLOWED.toResponse();
	}

	@ExceptionHandler(HttpMediaTypeNotSupportedException.class)
	ResponseEntity<ApiError.Body> unsupportedMediaType() {
		return ApiError.UNSUPPORTED_MEDIA_TYPE.toResponse();
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiError.Body> unexpected(Exception ex) {
		log.error("Unhandled exception", ex);
		return ApiError.INTERNAL_ERROR.toResponse();
	}
}
