package com.concertly.backend.security;

import com.concertly.backend.model.User;
import com.concertly.backend.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    public UserDetailsServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmailNormalized(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Kullanıcı bulunamadı: " + email));
        return toUserDetails(user);
    }

    /** Erişim token'ı kimliği: e-posta değişse de id sabittir (eski e-postayı devralan hesapla karışmaz). */
    @Transactional
    public UserDetails loadUserById(Long id) throws UsernameNotFoundException {
        User user = (id == null ? java.util.Optional.<User>empty() : userRepository.findById(id))
                .orElseThrow(() -> new UsernameNotFoundException("Kullanıcı bulunamadı: " + id));
        return toUserDetails(user);
    }

    private UserDetails toUserDetails(User user) {
        List<SimpleGrantedAuthority> authorities = user.getRoles() == null
                ? List.of()
                : user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority(role.getName()))
                .collect(Collectors.toList());

        // Admin tarafından yasaklanan (isActive=false) hesap devre dışıdır: login,
        // JWT filtresi ve token yenileme bunu kontrol eder. null = eski kayıt = aktif.
        boolean enabled = !Boolean.FALSE.equals(user.getIsActive());
        return new org.springframework.security.core.userdetails.User(
                user.getId() + ":" + user.getEmail(),
                user.getPassword(),
                enabled,
                true,
                true,
                true,
                authorities
        );
    }
}