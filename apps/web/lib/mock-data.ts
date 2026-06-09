import type {
  BookingStatus,
  FieldSize,
  FieldSummary,
  SportType,
  VenueSummary,
} from "@dat-san-vn/types";

export interface VenueFieldDetail extends FieldSummary {
  features: string[];
  pricePerSlot: number;
  availableSlots: string[];
}

export interface VenueDetail extends VenueSummary {
  amenities: string[];
  categoryLabel: string;
  description: string;
  districtLabel: string;
  distanceKm: number;
  gallery: string[];
  heroImage: string;
  openingHours: string;
  phone: string;
  rating: number;
  reviewCount: number;
  minPrice: number;
  highlight: string;
  fields: VenueFieldDetail[];
}

export interface BookingItem {
  id: string;
  venueId: string;
  venueName: string;
  fieldName: string;
  bookingDate: string;
  bookingTime: string;
  totalPrice: number;
  status: BookingStatus;
  address: string;
}

export interface VenueSearchFilters {
  q?: string;
  district?: string;
  size?: FieldSize | "ALL";
  priceMax?: number;
  startTime?: string;
}

const slotSetA = ["05:30", "06:30", "17:30", "18:30", "19:30", "20:30"];
const slotSetB = ["06:00", "07:00", "16:00", "18:00", "19:00", "21:00"];
const slotSetC = ["05:00", "06:00", "17:00", "18:00", "20:00", "21:30"];

function buildField(
  id: string,
  name: string,
  sportType: SportType,
  size: FieldSize,
  pricePerSlot: number,
  availableSlots: string[],
  features: string[],
): VenueFieldDetail {
  return {
    id,
    name,
    sportType,
    size,
    pricePerSlot,
    availableSlots,
    features,
  };
}

export const venueDetails: VenueDetail[] = [
  {
    id: "riverside-arena",
    name: "Riverside Arena",
    description:
      "Cụm sân bóng đá cỏ nhân tạo nằm sát bờ sông, ánh sáng tốt và có lounge nhỏ cho đội chờ.",
    address: "12 Bến Vân Đồn",
    district: "Quận 4",
    districtLabel: "Quận 4, TP.HCM",
    city: "TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80",
    ],
    amenities: ["Giữ xe", "Cafe", "Phòng thay đồ", "Nước uống"],
    isActive: true,
    fields: [
      buildField("rs-field-1", "Sân 7A", "FOOTBALL", "FIELD_7", 680000, slotSetA, [
        "Mặt cỏ mới thay",
        "Đèn LED đủ sáng",
        "Có camera ghi hình",
      ]),
      buildField("rs-field-2", "Sân 5B", "FOOTBALL", "FIELD_5", 420000, slotSetB, [
        "Gần khu cafe",
        "Vạch sân rõ",
        "Phù hợp đá phủi tối",
      ]),
    ],
    _count: { reviews: 186 },
    categoryLabel: "Sân nổi bật buổi tối",
    distanceKm: 3.2,
    gallery: [
      "https://images.unsplash.com/photo-1486286701208-1d58e9338013?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    ],
    heroImage:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    openingHours: "05:00 - 23:00",
    phone: "0901 345 678",
    rating: 4.8,
    reviewCount: 186,
    minPrice: 420000,
    highlight: "Giữ chất lượng sân rất ổn trong khung 18h-21h.",
  },
  {
    id: "city-goal-hub",
    name: "City Goal Hub",
    description:
      "Tổ hợp sân 5 và sân 7 ở trung tâm, thuận tiện cho đội đá sau giờ làm và pickup nhanh.",
    address: "88 Nguyễn Thị Minh Khai",
    district: "Quận 3",
    districtLabel: "Quận 3, TP.HCM",
    city: "TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1518604666860-9ed391f76460?auto=format&fit=crop&w=1200&q=80",
    ],
    amenities: ["Bãi xe máy", "Cho thuê áo bib", "Tủ lạnh mini"],
    isActive: true,
    fields: [
      buildField("cg-field-1", "Sân 5 Premium", "FOOTBALL", "FIELD_5", 390000, slotSetC, [
        "Khán đài mini",
        "Âm thanh cổ vũ",
        "Dịch vụ nước lạnh",
      ]),
      buildField("cg-field-2", "Sân 7 Center", "FOOTBALL", "FIELD_7", 620000, slotSetA, [
        "Mặt sân phẳng",
        "Hệ thống thoát nước tốt",
        "Có locker",
      ]),
    ],
    _count: { reviews: 121 },
    categoryLabel: "Đội văn phòng ưa chuộng",
    distanceKm: 2.4,
    gallery: [
      "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1508098682722-e99c643e7485?auto=format&fit=crop&w=1200&q=80",
    ],
    heroImage:
      "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
    openingHours: "06:00 - 23:30",
    phone: "0938 888 112",
    rating: 4.7,
    reviewCount: 121,
    minPrice: 390000,
    highlight: "Vị trí trung tâm, phù hợp đặt nhanh cho đội đi làm về.",
  },
  {
    id: "eastside-football-park",
    name: "Eastside Football Park",
    description:
      "Cụm sân ngoại thành rộng, có cả sân 11 để đá giao hữu và giải phong trào cuối tuần.",
    address: "205 Xa Lộ Hà Nội",
    district: "Thủ Đức",
    districtLabel: "Thủ Đức, TP.HCM",
    city: "TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1508098682722-e99c643e7485?auto=format&fit=crop&w=1200&q=80",
    ],
    amenities: ["Bãi xe ô tô", "Phòng y tế", "Phòng họp đội", "Máy bán nước tự động"],
    isActive: true,
    fields: [
      buildField("es-field-1", "Sân 11 Main", "FOOTBALL", "FIELD_11", 1450000, ["16:30", "18:30"], [
        "Chuẩn sân giải phong trào",
        "Có khán đài",
        "Có bảng tỷ số điện tử",
      ]),
      buildField("es-field-2", "Sân 7 East", "FOOTBALL", "FIELD_7", 650000, slotSetB, [
        "Lối đi rộng",
        "Nhiều góc check-in",
        "Phù hợp đội 14-16 người",
      ]),
    ],
    _count: { reviews: 94 },
    categoryLabel: "Phù hợp đá giải cuối tuần",
    distanceKm: 9.8,
    gallery: [
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1200&q=80",
    ],
    heroImage:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
    openingHours: "05:30 - 22:30",
    phone: "0977 112 889",
    rating: 4.6,
    reviewCount: 94,
    minPrice: 650000,
    highlight: "Không gian rộng, hợp các trận giao hữu đông người.",
  },
  {
    id: "greenfield-stadium",
    name: "Greenfield Stadium",
    description:
      "Sân cỏ mới, khu phụ trợ chỉnh chu và có dịch vụ tổ chức minileague theo gói.",
    address: "61 Đường số 9",
    district: "Bình Thạnh",
    districtLabel: "Bình Thạnh, TP.HCM",
    city: "TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80",
    ],
    amenities: ["Trọng tài liên kết", "Băng ghế dự bị", "Wifi", "Bảng chiến thuật"],
    isActive: true,
    fields: [
      buildField("gf-field-1", "Sân 7 Prime", "FOOTBALL", "FIELD_7", 710000, slotSetA, [
        "Dàn đèn chống chói",
        "Âm thanh nền",
        "Có khay nước cho đội",
      ]),
      buildField("gf-field-2", "Sân 5 Quickplay", "FOOTBALL", "FIELD_5", 450000, slotSetC, [
        "Ra vào nhanh",
        "Gần bãi giữ xe",
        "Phù hợp đặt gấp",
      ]),
    ],
    _count: { reviews: 158 },
    categoryLabel: "Trải nghiệm premium",
    distanceKm: 4.5,
    gallery: [
      "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80",
    ],
    heroImage:
      "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80",
    openingHours: "05:30 - 22:30",
    phone: "0907 551 551",
    rating: 4.9,
    reviewCount: 158,
    minPrice: 450000,
    highlight: "Phù hợp đội muốn trải nghiệm đẹp và dịch vụ gọn gàng.",
  },
  {
    id: "saigon-night-arena",
    name: "Saigon Night Arena",
    description:
      "Chuyên khung giờ tối muộn, phục vụ đội đá giao lưu sau 20h với giá mềm hơn giờ vàng.",
    address: "177 Lê Văn Thọ",
    district: "Gò Vấp",
    districtLabel: "Gò Vấp, TP.HCM",
    city: "TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1543357480-c60d40007a3f?auto=format&fit=crop&w=1200&q=80",
    ],
    amenities: ["Mở muộn", "Nước đá miễn phí", "Quầy snack"],
    isActive: true,
    fields: [
      buildField("sn-field-1", "Sân 5 Night Shift", "FOOTBALL", "FIELD_5", 350000, ["19:00", "20:00", "21:00", "22:00"], [
        "Giá mềm sau 20h",
        "Đèn sáng ổn định",
        "Nhân viên hỗ trợ nhanh",
      ]),
      buildField("sn-field-2", "Sân 7 Midnight", "FOOTBALL", "FIELD_7", 560000, ["18:00", "20:00", "21:30"], [
        "Có máy chấm công đội",
        "Sân khô nhanh sau mưa",
        "Có loa gọi đội",
      ]),
    ],
    _count: { reviews: 73 },
    categoryLabel: "Đá muộn giá tốt",
    distanceKm: 6.4,
    gallery: [
      "https://images.unsplash.com/photo-1570498839593-e565b39455fc?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1543357480-c60d40007a3f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1494173853739-c21f58b16055?auto=format&fit=crop&w=1200&q=80",
    ],
    heroImage:
      "https://images.unsplash.com/photo-1570498839593-e565b39455fc?auto=format&fit=crop&w=1200&q=80",
    openingHours: "06:00 - 23:59",
    phone: "0903 900 115",
    rating: 4.5,
    reviewCount: 73,
    minPrice: 350000,
    highlight: "Rất hợp đội muốn né giờ cao điểm và tối ưu chi phí.",
  },
  {
    id: "thao-dien-club",
    name: "Thảo Điền Club",
    description:
      "Cụm sân boutique với không gian sáng, sạch, phù hợp nhóm bạn và cộng đồng expat.",
    address: "31 Quốc Hương",
    district: "Quận 2",
    districtLabel: "Quận 2, TP.HCM",
    city: "TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1489945052260-4f21c52268b9?auto=format&fit=crop&w=1200&q=80",
    ],
    amenities: ["Phòng tắm", "Cafe specialty", "Cho thuê áo đấu"],
    isActive: true,
    fields: [
      buildField("td-field-1", "Sân 5 Corner", "FOOTBALL", "FIELD_5", 480000, slotSetB, [
        "Không gian boutique",
        "Có khu ngồi chờ đẹp",
        "Phù hợp đá giao lưu",
      ]),
      buildField("td-field-2", "Sân 7 Social", "FOOTBALL", "FIELD_7", 690000, ["06:30", "17:30", "18:30", "20:30"], [
        "Nhiều đội quốc tế",
        "Setup giao hữu nhanh",
        "Có hỗ trợ bóng đấu",
      ]),
    ],
    _count: { reviews: 88 },
    categoryLabel: "Không gian đẹp, đá chill",
    distanceKm: 7.1,
    gallery: [
      "https://images.unsplash.com/photo-1489945052260-4f21c52268b9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1494173853739-c21f58b16055?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80",
    ],
    heroImage:
      "https://images.unsplash.com/photo-1494173853739-c21f58b16055?auto=format&fit=crop&w=1200&q=80",
    openingHours: "06:00 - 22:00",
    phone: "0962 441 889",
    rating: 4.7,
    reviewCount: 88,
    minPrice: 480000,
    highlight: "Không gian sáng và phù hợp cho đội muốn trải nghiệm sạch, đẹp.",
  },
];

export const featuredVenues = venueDetails.slice(0, 6);

export const testimonials = [
  {
    id: "testimonial-1",
    quote:
      "Ứng dụng rất mượt trên điện thoại, thao tác chốt sân vô cùng nhanh gọn. Đội mình giờ không cần nhắn tin lòng vòng qua Zalo nữa.",
    author: "Phúc Nguyễn",
    role: "Đội trưởng FC Tân Cảng",
  },
  {
    id: "testimonial-2",
    quote:
      "Thông tin sân rõ ràng, nhìn vào là biết ngay còn slot nào. Tiết kiệm cả buổi so với hồi phải gọi điện hỏi từng nơi.",
    author: "Linh Trần",
    role: "Người chơi phong trào, Quận 3",
  },
  {
    id: "testimonial-3",
    quote:
      "Đặt sân trên đường đi làm về mà vẫn xong trong chưa đầy một phút. Lịch sử đặt sân lưu lại gọn gàng, tiện theo dõi chi phí cả tháng.",
    author: "Minh Hoàng",
    role: "Quản lý đội văn phòng, Bình Thạnh",
  },
];

export const bookingItems: BookingItem[] = [
  {
    id: "BK-240501",
    venueId: "greenfield-stadium",
    venueName: "Greenfield Stadium",
    fieldName: "Sân 7 Prime",
    bookingDate: "18/04/2026",
    bookingTime: "18:30 - 20:00",
    totalPrice: 710000,
    status: "CONFIRMED",
    address: "61 Đường số 9, Bình Thạnh",
  },
  {
    id: "BK-240498",
    venueId: "city-goal-hub",
    venueName: "City Goal Hub",
    fieldName: "Sân 5 Premium",
    bookingDate: "20/04/2026",
    bookingTime: "19:00 - 20:30",
    totalPrice: 390000,
    status: "PENDING",
    address: "88 Nguyễn Thị Minh Khai, Quận 3",
  },
  {
    id: "BK-240455",
    venueId: "riverside-arena",
    venueName: "Riverside Arena",
    fieldName: "Sân 7A",
    bookingDate: "05/04/2026",
    bookingTime: "18:30 - 20:00",
    totalPrice: 680000,
    status: "COMPLETED",
    address: "12 Bến Vân Đồn, Quận 4",
  },
];

export const venueCategories = [
  {
    label: "Sân 5",
    size: "FIELD_5" as const,
    description: "Nhanh, gọn, phù hợp đội ít người và khung giờ sau giờ làm.",
  },
  {
    label: "Sân 7",
    size: "FIELD_7" as const,
    description: "Loại phổ biến nhất cho giải phủi, giao hữu và đội văn phòng.",
  },
  {
    label: "Sân 11",
    size: "FIELD_11" as const,
    description: "Dành cho trận đông người, giải cuối tuần và đá phong trào lớn.",
  },
];

export const allDistricts = Array.from(new Set(venueDetails.map((venue) => venue.district)));

export function toVenueSummary(venue: VenueDetail): VenueSummary {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    district: venue.district,
    city: venue.city,
    images: venue.images,
    isActive: venue.isActive,
    fields: venue.fields.map((field) => ({
      id: field.id,
      name: field.name,
      size: field.size,
      sportType: field.sportType,
    })),
    _count: venue._count,
  };
}

export function filterVenues(filters: VenueSearchFilters) {
  return venueDetails.filter((venue) => {
    const keyword = filters.q?.trim().toLowerCase();
    const district = filters.district?.trim();
    const size = filters.size;
    const priceMax = filters.priceMax;
    const startTime = filters.startTime;

    const matchesKeyword =
      !keyword ||
      venue.name.toLowerCase().includes(keyword) ||
      venue.address.toLowerCase().includes(keyword) ||
      venue.districtLabel.toLowerCase().includes(keyword);

    const matchesDistrict = !district || district === "ALL" || venue.district === district;
    const matchesSize = !size || size === "ALL" || venue.fields.some((field) => field.size === size);
    const matchesPrice = !priceMax || venue.fields.some((field) => field.pricePerSlot <= priceMax);
    const matchesTime =
      !startTime ||
      venue.fields.some((field) => field.availableSlots.some((slot) => slot.startsWith(startTime.slice(0, 2))));

    return matchesKeyword && matchesDistrict && matchesSize && matchesPrice && matchesTime;
  });
}
