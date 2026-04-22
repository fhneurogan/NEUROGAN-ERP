import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "../storage";
import { verifyPassword } from "./password";

// Passport-local strategy. Lockout + rotation checks live in the login
// route handler so the correct HTTP status (423/200+mustRotate) is returned.
// This strategy only verifies email+password matches an existing user.
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email.toLowerCase().trim());
        if (!user) return done(null, false);

        const matches = await verifyPassword(user.passwordHash, password);
        if (!matches) return done(null, false);

        // Load roles to satisfy Express.User shape (roles live in a separate table).
        const response = await storage.getUserById(user.id);
        if (!response) return done(null, false);
        return done(null, {
          id: response.id,
          email: response.email,
          roles: response.roles,
          status: response.status,
        });
      } catch (err) {
        return done(err);
      }
    },
  ),
);

// Only the user id is stored in the session cookie.
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id);
});

// Reload full user+roles from DB on every request so role/status changes
// take effect without requiring re-login.
passport.deserializeUser(async (id: string, done) => {
  console.log(`[deserialize] called with id=${id}`);
  try {
    const response = await storage.getUserById(id);
    console.log(`[deserialize] found=${!!response} status=${response?.status}`);
    if (!response || response.status !== "ACTIVE") return done(null, false);
    done(null, {
      id: response.id,
      email: response.email,
      roles: response.roles,
      status: response.status,
    });
  } catch (err) {
    done(err);
  }
});

export { passport };
