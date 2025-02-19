/**
 * Encryption Algorithm
 */
export enum ALGORITHM {
    AES128 = "AES128",
    AES192 = "AES192",
    AES256 = "AES256",
  }


/**
 * Key Length needed for each ALGORITHM
 */
export const ALGO: { [key in ALGORITHM]: number } = {
  [ALGORITHM.AES128]: 32,
  [ALGORITHM.AES192]: 47,
  [ALGORITHM.AES256]: 64,
};
