"use client";

import { useRouter } from "next/navigation";
import { VideoForm } from "./VideoForm";

/**
 * Wrapper for VideoForm on create page
 * Handles redirect to video list on success
 */
export function VideoCreateForm() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push("/admin/videos");
  };

  return <VideoForm onSuccess={handleSuccess} />;
}
