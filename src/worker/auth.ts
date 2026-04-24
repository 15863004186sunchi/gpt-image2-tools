export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  plan: "free" | "pro";
}

export function getDemoUser(): AuthenticatedUser {
  return {
    id: "demo-user",
    email: "demo@gpt-image2.tools",
    displayName: "Demo Creator",
    plan: "free",
  };
}
