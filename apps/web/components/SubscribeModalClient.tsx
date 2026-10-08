"use client";

import React, { useState, useEffect } from "react";
import { SubscribeModal } from "./SubscribeModal";

interface SubscribeModalClientProps {
  productSlug?: string;
}

export function SubscribeModalClient({ productSlug }: SubscribeModalClientProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    document.addEventListener("open-subscribe-modal", handleOpen);
    return () => document.removeEventListener("open-subscribe-modal", handleOpen);
  }, []);

  return (
    <SubscribeModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      productSlug={productSlug}
    />
  );
}
