package com.flashcart.common.exception;

import com.flashcart.common.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private String correlationId() {
        String id = MDC.get("correlationId");
        return id != null ? id : "N/A";
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFound(ResourceNotFoundException ex) {
        log.warn("[{}] ResourceNotFoundException: {}", correlationId(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(),
                ApiResponse.ErrorDetails.builder().code(ex.getErrorCode()).build());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicate(DuplicateResourceException ex) {
        log.warn("[{}] DuplicateResourceException: {}", correlationId(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(),
                ApiResponse.ErrorDetails.builder().code(ex.getErrorCode()).build());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InsufficientInventoryException.class)
    public ResponseEntity<ApiResponse<Void>> handleInsufficientInventory(InsufficientInventoryException ex) {
        log.warn("[{}] InsufficientInventoryException: {}", correlationId(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(),
                ApiResponse.ErrorDetails.builder().code(ex.getErrorCode()).build());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(FlashSaleException.class)
    public ResponseEntity<ApiResponse<Void>> handleFlashSale(FlashSaleException ex) {
        log.warn("[{}] FlashSaleException: {}", correlationId(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(),
                ApiResponse.ErrorDetails.builder().code(ex.getErrorCode()).build());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidOperationException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidOperation(InvalidOperationException ex) {
        log.warn("[{}] InvalidOperationException: {}", correlationId(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(),
                ApiResponse.ErrorDetails.builder().code(ex.getErrorCode()).build());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(PaymentException.class)
    public ResponseEntity<ApiResponse<Void>> handlePayment(PaymentException ex) {
        log.warn("[{}] PaymentException: {}", correlationId(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(),
                ApiResponse.ErrorDetails.builder().code(ex.getErrorCode()).build());
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(response);
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnauthorized(UnauthorizedException ex) {
        log.warn("[{}] UnauthorizedException: {}", correlationId(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(),
                ApiResponse.ErrorDetails.builder().code(ex.getErrorCode()).build());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(FlashCartException.class)
    public ResponseEntity<ApiResponse<Void>> handleFlashCartException(FlashCartException ex) {
        log.warn("[{}] FlashCartException: {}", correlationId(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(),
                ApiResponse.ErrorDetails.builder().code(ex.getErrorCode()).build());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(MethodArgumentNotValidException ex) {
        log.warn("[{}] Validation error: {}", correlationId(), ex.getMessage());
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }
        ApiResponse<Map<String, String>> response = ApiResponse.<Map<String, String>>builder()
                .success(false)
                .message("Validation failed")
                .data(fieldErrors)
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException ex) {
        log.warn("[{}] BadCredentials: {}", correlationId(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("Invalid email or password",
                        ApiResponse.ErrorDetails.builder().code("BAD_CREDENTIALS").build()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthentication(AuthenticationException ex) {
        log.warn("[{}] AuthenticationException: {}", correlationId(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("Authentication required",
                        ApiResponse.ErrorDetails.builder().code("AUTHENTICATION_REQUIRED").build()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("[{}] AccessDeniedException: {}", correlationId(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Access denied",
                        ApiResponse.ErrorDetails.builder().code("ACCESS_DENIED").build()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadable(HttpMessageNotReadableException ex) {
        log.warn("[{}] HttpMessageNotReadable: {}", correlationId(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Malformed request body",
                        ApiResponse.ErrorDetails.builder().code("MALFORMED_REQUEST").build()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("[{}] TypeMismatch: {}", correlationId(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Invalid parameter: " + ex.getName(),
                        ApiResponse.ErrorDetails.builder().code("INVALID_PARAMETER").field(ex.getName()).build()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("[{}] Unexpected error: {}", correlationId(), ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("An unexpected error occurred. Please try again later.",
                        ApiResponse.ErrorDetails.builder().code("INTERNAL_ERROR").build()));
    }
}
