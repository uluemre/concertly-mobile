package com.concertly.backend.exception;

// ✅ 409 — zaten mevcut (duplicate like, duplicate follow vb.)
public class AlreadyExistsException extends RuntimeException {
    public AlreadyExistsException(String message) {
        super(message);
    }
}