/**
 * Backend ConcertResponse karşılığı.
 *
 * Proje düz JavaScript; bu dosya derlemeye girmez, yalnızca editörde otomatik
 * tamamlama ve tip kontrolü sağlar. Alanlar backend'deki
 * dto/response/ConcertResponse.java ile birebir aynıdır — orada bir alan
 * değişirse burası da güncellenmelidir.
 *
 * Kaynak bilgisi (source / sourceUrl / externalId) bilerek yoktur.
 */
export interface Concert {
  id: number;
  name: string;
  /** ISO tarih, Türkiye duvar saati. */
  eventDate: string;
  genre: string | null;
  imageUrl: string | null;
  ticketUrl: string | null;
  /** Kaynağı doğrulanmış etkinlik rozeti. */
  isVerified: boolean | null;

  artistId: number | null;
  artistName: string | null;
  artistImageUrl: string | null;

  venueId: number | null;
  venueName: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  /** Bilet alınabilecek adresler; backend merge sonrası birden fazla olabilir. */
  ticketLinks?: TicketLink[];
}

/** Kullanıcıya gösterilen bilet bağlantısı. Kaynak/enum bilgisi taşımaz. */
export interface TicketLink {
  /** Site adı: Biletix, Biletinial ... */
  label: string;
  url: string;
}

/** GET /api/concerts sayfalı cevabı. */
export interface ConcertPage {
  content: Concert[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface ConcertQuery {
  city?: string | null;
  artist?: string | null;
  past?: boolean;
  page?: number;
  size?: number;
}
