import { createContext, useContext } from 'react';

export const MerchantContext = createContext(null);

export function useMerchant() {
  return useContext(MerchantContext);
}
