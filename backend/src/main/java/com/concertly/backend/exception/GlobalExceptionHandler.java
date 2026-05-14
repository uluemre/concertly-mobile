package com.concertly.backend.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // 401 — hatalı email veya şifre
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError(401, "Email veya şifre hatalı."));
    }

    // 404 — bulunamadı
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(new ApiError(404, ex.getMessage()));
    }

    // 409 — zaten mevcut
    @ExceptionHandler(AlreadyExistsException.class)
    public ResponseEntity<ApiError> handleConflict(AlreadyExistsException ex) {
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ApiError(409, ex.getMessage()));
    }

    // 400 — geçersiz istek
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(400, ex.getMessage()));
    }

    // 409 — veritabanı constraint ihlali (unique, foreign key vs.)
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException ex) {
        String msg = ex.getMessage();
        if (msg != null) {
            if (msg.contains("phone")) msg = "Bu telefon numarası zaten kullanılıyor.";
            else if (msg.contains("username")) msg = "Bu kullanıcı adı zaten kullanılıyor.";
            else if (msg.contains("email")) msg = "Bu email zaten kullanılıyor.";
            else msg = "Bu veri zaten kullanılıyor.";
        }
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ApiError(409, msg));
    }

    // 500 — beklenmedik hatalar
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneral(Exception ex) {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError(500, "Beklenmedik bir hata oluştu."));
    }
}