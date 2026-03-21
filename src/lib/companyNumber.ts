const SHORT_NUMERIC_COMPANY_NUMBER_PATTERN = /^\d{1,7}$/;

export const normalizeCompanyNumber = (companyNumber: string): string => {
  const trimmedCompanyNumber = companyNumber.trim();

  return SHORT_NUMERIC_COMPANY_NUMBER_PATTERN.test(trimmedCompanyNumber)
    ? trimmedCompanyNumber.padStart(8, "0")
    : trimmedCompanyNumber;
};
