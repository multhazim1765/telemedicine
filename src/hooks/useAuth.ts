import { useEffect, useState } from "react";
import { observeAuth, getCurrentUserProfile } from "../services/authService";
import { AppUser } from "../types/models";

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const unsub = observeAuth(async (uid) => {
      if (!uid) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const profile = await getCurrentUserProfile(uid);
      setUser(profile);
      setIsLoading(false);
    });

    return unsub;
  }, []);

  return { user, isLoading };
};
