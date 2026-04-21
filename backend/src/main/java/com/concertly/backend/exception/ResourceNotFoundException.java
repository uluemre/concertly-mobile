package com.concertly.backend.exception;

// ✅ 404 — kaynak bulunamadı
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}