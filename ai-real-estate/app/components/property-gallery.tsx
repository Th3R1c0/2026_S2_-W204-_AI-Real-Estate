"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Grid2X2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

export default function PropertyGallery({
  address,
  photos,
}: {
  address: string;
  photos: string[];
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const opener = useRef<HTMLElement | null>(null);
  const unavailable = photos[0] === "/properties/address-placeholder.svg";
  useEffect(() => {
    if (!api) return;
    const select = () => setIndex(api.selectedScrollSnap());
    api.on("select", select);
    return () => {
      api.off("select", select);
    };
  }, [api]);
  function showPhoto(photo: number, element: HTMLElement) {
    opener.current = element;
    setStartIndex(photo);
    setIndex(photo);
    setOpen(true);
  }
  function move(step: number) {
    const next = (index + step + photos.length) % photos.length;
    setIndex(next);
    api?.scrollTo(next);
  }
  return (
    <>
      <section
        aria-label="Property photo gallery"
        className={`property-mosaic-section mosaic-count-${Math.min(photos.length, 5)}`}
      >
        <div className="property-mosaic-grid">
          {photos.slice(0, 5).map((photo, photoIndex) => (
            <Button
              variant="ghost"
              aria-label={`Open photo ${photoIndex + 1}`}
              className={
                photoIndex === 0 ? "mosaic-main-item" : "mosaic-sub-item"
              }
              key={photo}
              onClick={(event) => showPhoto(photoIndex, event.currentTarget)}
              type="button"
            >
              <Image
                alt={
                  unavailable
                    ? `Photo unavailable for ${address}`
                    : `${address}, photo ${photoIndex + 1}`
                }
                fill
                loading={photoIndex === 0 ? "eager" : "lazy"}
                sizes={
                  photoIndex === 0 ? "(max-width: 700px) 100vw, 50vw" : "25vw"
                }
                src={photo}
              />
            </Button>
          ))}
        </div>
        {!unavailable && (
          <Button
            variant="outline"
            className="show-all-photos-btn"
            onClick={(event) => showPhoto(0, event.currentTarget)}
            type="button"
          >
            <Grid2X2 data-icon="inline-start" />
            {photos.length} photos
          </Button>
        )}
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="gallery-dialog"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          onKeyDownCapture={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              event.stopPropagation();
              move(-1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              event.stopPropagation();
              move(1);
            }
          }}
        >
          <DialogTitle>Photos of {address}</DialogTitle>
          <p aria-live="polite" className="gallery-counter">
            {index + 1} / {photos.length}
          </p>
          <Carousel
            key={startIndex}
            opts={{ loop: true, startIndex }}
            setApi={setApi}
            className="gallery-carousel"
          >
            <CarouselContent>
              {photos.map((photo, photoIndex) => (
                <CarouselItem key={photo} aria-hidden={photoIndex !== index}>
                  <div className="gallery-slide">
                    <Image
                      alt={`${address}, photo ${photoIndex + 1}`}
                      fill
                      sizes="90vw"
                      src={photo}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {photos.length > 1 && (
              <>
                <CarouselPrevious
                  aria-label="Previous photo"
                  disabled={false}
                  onClick={() => move(-1)}
                />
                <CarouselNext
                  aria-label="Next photo"
                  disabled={false}
                  onClick={() => move(1)}
                />
              </>
            )}
          </Carousel>
        </DialogContent>
      </Dialog>
    </>
  );
}
