"use client";

import { createAuthClient } from "better-auth/react";

/** Browser side of accounts: sign up, log in, session, password reset (talks to /api/auth). */
export const authClient = createAuthClient();
