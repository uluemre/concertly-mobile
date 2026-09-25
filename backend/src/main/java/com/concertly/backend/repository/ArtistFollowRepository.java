package com.concertly.backend.repository;

import com.concertly.backend.model.ArtistFollow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;

import java.util.List;
import java.util.Optional;

public interface ArtistFollowRepository extends JpaRepository<ArtistFollow, Long> {
    Optional<ArtistFollow> findByUserIdAndArtistId(Long userId, Long artistId);
    long countByArtistId(Long artistId);
    List<ArtistFollow> findAllByUserId(Long userId);
    List<ArtistFollow> findAllByArtistId(Long artistId);

    /** Birden çok sanatçının takipçi sayısı tek sorguda: [artistId, count] */
    @Query("select f.artist.id, count(f) from ArtistFollow f where f.artist.id in :artistIds group by f.artist.id")
    List<Object[]> countByArtistIds(@Param("artistIds") Collection<Long> artistIds);

    /** Kullanıcının takip ettiği sanatçı id'leri */
    @Query("select f.artist.id from ArtistFollow f where f.user.id = :userId")
    List<Long> findArtistIdsByUserId(@Param("userId") Long userId);
}