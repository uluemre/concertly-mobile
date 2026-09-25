package com.concertly.backend.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

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

    // 403 — yetkisiz erişim (ör. başkasının kaynağını değiştirme denemesi)
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(new ApiError(403, ex.getMessage()));
    }

    // 400 — geçersiz istek
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(400, ex.getMessage()));
    }

    // 400 — adres/parametre tipi uyuşmuyor (ör. /api/events/null, /api/artists/NaN).
    // Bu handler olmadan aşağıdaki Exception.class catch-all'ına düşüp 500 dönüyordu;
    // istemcinin hatası sunucu hatası gibi görünüyordu.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(400, "Geçersiz parametre: " + ex.getName()));
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

    // Servis/controller'ın bilerek seçtiği HTTP durumunu koru.
    // Bu handler OLMADAN ResponseStatusException aşağıdaki Exception.class
    // catch-all'ına düşüyor ve 409/403/400 niyetleri 500 olarak dönüyordu —
    // istemci tarafındaki durum koduna bakan akışlar (ör. "zaten doğrulandı"
    // için 409 kontrolü) bu yüzden hiç çalışmıyordu.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex) {
        int status = ex.getStatusCode().value();
        String msg = ex.getReason() != null ? ex.getReason() : ex.getMessage();
        return ResponseEntity.status(status).body(new ApiError(status, msg));
    }

    // 500 — beklenmedik hatalar
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneral(Exception ex) {
        ex.printStackTrace();
        String msg = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError(500, "Sunucu hatası: " + msg));
    }
}