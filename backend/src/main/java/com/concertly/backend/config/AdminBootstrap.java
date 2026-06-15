package com.concertly.backend.config;

import com.concertly.backend.model.Role;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.RoleRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.HashSet;

/**
 * Açılışta ROLE_ADMIN rolünün var olduğundan emin olur ve ADMIN_EMAIL env'inde
 * belirtilen kullanıcıyı (varsa) admin yapar. Taze veritabanında (örn. Railway)
 * ilk admin'i oluşturmak için tek yol budur — make-admin endpoint'i kendisi de
 * admin yetkisi istediği için API üzerinden bootstrap mümkün değil.
 *
 * Idempotent: rol zaten varsa/yeni değilse tekrar oluşturmaz, kullanıcı zaten
 * admin'se dokunmaz. ADMIN_EMAIL boşsa ya da kullanıcı henüz kayıtlı değilse
 * sessizce no-op olur (kullanıcı kaydolduktan sonra yeniden başlatınca devreye girer).
 */
@Component
@Order(1)
public class AdminBootstrap implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;

    @Value("${admin.bootstrap.email:}")
    private String adminEmail;

    public AdminBootstrap(RoleRepository roleRepository, UserRepository userRepository) {
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
    }

    @Override
    public void run(String... args) {
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setName("ROLE_ADMIN");
                    return roleRepository.save(r);
                });

        if (adminEmail == null || adminEmail.isBlank()) return;

        userRepository.findByEmail(adminEmail.trim()).ifPresent(user -> {
            if (user.getRoles() == null) user.setRoles(new HashSet<>());
            boolean alreadyAdmin = user.getRoles().stream()
                    .anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
            if (!alreadyAdmin) {
                user.getRoles().add(adminRole);
                userRepository.save(user);
                System.out.println("✅ Admin bootstrap: " + adminEmail + " ROLE_ADMIN yapıldı.");
            }
        });
    }
}
