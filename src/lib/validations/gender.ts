import { z } from "zod";
import { GENDERS } from "@/lib/profile/gender";

/** A required בן / בת choice, as on /join and the signing page. */
export const genderField = z.enum(GENDERS, { message: "יש לבחור בן או בת" });

/** The staff user form: "" means not set, which the action stores as null. */
export const optionalGenderField = z.enum(["", "male", "female"]);
