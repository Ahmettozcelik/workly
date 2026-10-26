package com.workly.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * Error responses of the API: RFC 9457 problem details with a machine-readable
 * {@code code}. Clients translate codes; messages never carry user input,
 * stack traces or whether an account exists.
 */
public enum ApiError {

	VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
	MALFORMED_REQUEST(HttpStatus.BAD_REQUEST),
	UNAUTHENTICATED(HttpStatus.UNAUTHORIZED),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
	FORBIDDEN(HttpStatus.FORBIDDEN),
	CSRF_INVALID(HttpStatus.FORBIDDEN),
	VERIFICATION_TOKEN_INVALID(HttpStatus.BAD_REQUEST),
	PASSWORD_RESET_TOKEN_INVALID(HttpStatus.BAD_REQUEST),
	NOT_FOUND(HttpStatus.NOT_FOUND),
	METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),
	UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE),
	RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

	private final HttpStatus status;

	ApiError(HttpStatus status) {
		this.status = status;
	}

	public HttpStatus status() {
		return status;
	}

	public ResponseEntity<Body> toResponse() {
		return toResponse(null);
	}

	public ResponseEntity<Body> toResponse(List<FieldError> errors) {
		return ResponseEntity.status(status)
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.body(new Body("about:blank", status.getReasonPhrase(), status.value(), name(), errors));
	}

	/** The same body as JSON, for responses written by security filters (no user data in it). */
	public String toJson() {
		return "{\"type\":\"about:blank\",\"title\":\"%s\",\"status\":%d,\"code\":\"%s\"}"
			.formatted(status.getReasonPhrase(), status.value(), name());
	}

	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record Body(String type, String title, int status, String code, List<FieldError> errors) {
	}

	/** A rejected request field; {@code code} is the constraint's message (REQUIRED, TOO_SHORT, ...). */
	public record FieldError(String field, String code) {
	}
}
