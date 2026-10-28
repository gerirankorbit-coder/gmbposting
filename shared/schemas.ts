import { z } from 'zod';
import { ROLES } from './types.js';

export const roleSchema = z.enum(ROLES);

export const uuidSchema = z.string().uuid();
