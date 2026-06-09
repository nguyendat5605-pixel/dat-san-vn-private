import Image from "next/image";
import {
  getSafeImageUrl,
  shouldUnoptimizeImage,
} from "@/lib/utils";

const fallbackImages = [
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518605368461-1ee12523e800?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1516622437599-521b44ecad9c?auto=format&fit=crop&w=1200&q=80",
];

export function VenueGallery({
  name,
  images,
}: Readonly<{
  name: string;
  images: string[];
}>) {
  const safeImages = images.map(getSafeImageUrl).filter(Boolean);
  const gallery = [...safeImages];
  
  // Fill with fallbacks until we have at least 3 images
  let i = 0;
  while (gallery.length < 3) {
    gallery.push(fallbackImages[i % fallbackImages.length]);
    i++;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
      <div className="relative min-h-[320px] overflow-hidden rounded-[32px]">
        <Image
          src={gallery[0]}
          alt={name}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 66vw"
          unoptimized={shouldUnoptimizeImage(gallery[0])}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {gallery.slice(1, 3).map((image, index) => (
          <div key={`${image}-${index}`} className="relative min-h-[152px] overflow-hidden rounded-[28px]">
            <Image
              src={image}
              alt={`${name} - ảnh ${index + 2}`}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 24vw"
              unoptimized={shouldUnoptimizeImage(image)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
