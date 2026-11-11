package com.flashcart.user.service;

import com.flashcart.auth.entity.User;
import com.flashcart.auth.repository.RefreshTokenRepository;
import com.flashcart.auth.repository.UserRepository;
import com.flashcart.common.enums.UserRole;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.ResourceNotFoundException;
import com.flashcart.common.response.PageResponse;
import com.flashcart.user.dto.*;
import com.flashcart.user.entity.Address;
import com.flashcart.user.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;

    @Transactional(readOnly = true)
    public UserDto getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        return toUserDto(user);
    }

    @Transactional
    public UserDto updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName() != null ? request.getLastName().trim() : null);
        user.setPhone(request.getPhone() != null ? request.getPhone().trim() : null);
        return toUserDto(userRepository.save(user));
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new InvalidOperationException("Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(userId, Instant.now());
    }

    @Transactional(readOnly = true)
    public List<AddressDto> getUserAddresses(UUID userId) {
        return addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(userId)
                .stream()
                .map(this::toAddressDto)
                .toList();
    }

    @Transactional
    public AddressDto createAddress(UUID userId, AddressRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        if (request.isDefault()) {
            addressRepository.clearDefaultForUser(userId);
        }

        Address address = Address.builder()
                .user(user)
                .fullName(request.getFullName().trim())
                .phone(request.getPhone())
                .addressLine1(request.getAddressLine1().trim())
                .addressLine2(request.getAddressLine2())
                .city(request.getCity().trim())
                .state(request.getState().trim())
                .postalCode(request.getPostalCode().trim())
                .country(request.getCountry() != null ? request.getCountry().trim() : "India")
                .isDefault(request.isDefault())
                .build();

        return toAddressDto(addressRepository.save(address));
    }

    @Transactional
    public AddressDto updateAddress(UUID userId, UUID addressId, AddressRequest request) {
        Address address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Address", addressId.toString()));

        if (request.isDefault()) {
            addressRepository.clearDefaultForUser(userId);
        }

        address.setFullName(request.getFullName().trim());
        address.setPhone(request.getPhone());
        address.setAddressLine1(request.getAddressLine1().trim());
        address.setAddressLine2(request.getAddressLine2());
        address.setCity(request.getCity().trim());
        address.setState(request.getState().trim());
        address.setPostalCode(request.getPostalCode().trim());
        address.setCountry(request.getCountry() != null ? request.getCountry().trim() : "India");
        address.setDefault(request.isDefault());

        return toAddressDto(addressRepository.save(address));
    }

    @Transactional
    public void deleteAddress(UUID userId, UUID addressId) {
        Address address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Address", addressId.toString()));
        addressRepository.delete(address);
    }

    @Transactional(readOnly = true)
    public PageResponse<UserDto> listCustomers(String search, Pageable pageable) {
        String normalizedSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        Page<User> userPage = normalizedSearch == null
                ? userRepository.findByRole(UserRole.CUSTOMER, pageable)
                : userRepository.searchUsersByRole(UserRole.CUSTOMER, normalizedSearch, pageable);
        return PageResponse.from(userPage.map(this::toUserDto));
    }

    @Transactional
    public UserDto setCustomerEnabled(UUID customerId, boolean enabled) {
        User user = userRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("User", customerId.toString()));
        if (user.getRole() == UserRole.ADMIN) {
            throw new InvalidOperationException("Cannot modify status of admin account");
        }
        user.setEnabled(enabled);
        if (!enabled) {
            refreshTokenRepository.revokeAllByUserId(customerId, Instant.now());
        }
        return toUserDto(userRepository.save(user));
    }

    public UserDto toUserDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .role(user.getRole())
                .enabled(user.isEnabled())
                .createdAt(user.getCreatedAt())
                .build();
    }

    public AddressDto toAddressDto(Address address) {
        return AddressDto.builder()
                .id(address.getId())
                .fullName(address.getFullName())
                .phone(address.getPhone())
                .addressLine1(address.getAddressLine1())
                .addressLine2(address.getAddressLine2())
                .city(address.getCity())
                .state(address.getState())
                .postalCode(address.getPostalCode())
                .country(address.getCountry())
                .isDefault(address.isDefault())
                .createdAt(address.getCreatedAt())
                .build();
    }
}
