package com.concertly.backend.service;

import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<UserResponse> getUsers() {
        return userRepository.findAll()
                .stream()
                .map(u -> new UserResponse(u.getId(), u.getUsername(), u.getEmail()))
                .toList();
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + id));
        return new UserResponse(user.getId(), user.getUsername(), user.getEmail());
    }
}