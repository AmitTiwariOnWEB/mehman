import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as authService from "../services/authService.js";

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8)
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
});

export const mobileLoginSchema = z.object({
  body: z.object({
    identifier: z.string().min(2),
    password: z.string().min(8)
  })
});

export const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(20) })
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated.body);
  res.json(result);
});

export const mobileLogin = asyncHandler(async (req, res) => {
  const result = await authService.mobileLogin(req.validated.body);
  res.json(result);
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.validated.body.refreshToken);
  res.json(result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.validated.body.refreshToken);
  res.status(204).send();
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.currentUser(req.user.id);
  res.json({ user });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.validated.body);
  res.json({ message: "Password changed successfully" });
});
