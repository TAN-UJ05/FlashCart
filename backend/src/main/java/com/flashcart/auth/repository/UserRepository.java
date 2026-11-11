package com.flashcart.auth.repository;

import com.flashcart.auth.entity.User;
import com.flashcart.common.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Page<User> findByRole(UserRole role, Pageable pageable);

    @Query("""
            SELECT u FROM User u
            WHERE u.role = :role
              AND (LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%')))
            """)
    Page<User> searchUsersByRole(@Param("role") UserRole role, @Param("search") String search, Pageable pageable);

    long countByRole(UserRole role);
}
