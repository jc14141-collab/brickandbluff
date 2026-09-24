// Round each chip charge or reward, including half losses, away from zero.
export const roundChips=n=>Math.sign(n)*Math.round(Math.abs(n));
