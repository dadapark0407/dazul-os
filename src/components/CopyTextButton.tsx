"use client";

import { useState } from "react";

type CopyTextButtonProps = {
  text: string;
  label?: string;
};

export default function CopyTextButton({
  text,
  label = "복사",
}: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error("복사 실패:", error);
      alert("복사에 실패했어요. 다시 시도해주세요.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {copied ? "복사 완료" : label}
    </button>
  );
}