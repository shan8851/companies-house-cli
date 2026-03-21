import type { CommandEnvelope } from "./cli.js";

export interface NormalizedAddress {
  addressLine1: string | null;
  addressLine2: string | null;
  careOf: string | null;
  country: string | null;
  formatted: string | null;
  locality: string | null;
  poBox: string | null;
  postalCode: string | null;
  premises: string | null;
  region: string | null;
}

export interface NormalizedDateOfBirth {
  day: number | null;
  formatted: string | null;
  month: number | null;
  year: number | null;
}

export interface NormalizedCompanySearchResult {
  address: NormalizedAddress | null;
  companyNumber: string | null;
  companyStatus: string | null;
  companyType: string | null;
  dateOfCessation: string | null;
  dateOfCreation: string | null;
  description: string | null;
  descriptionIdentifiers: string[];
  name: string | null;
  snippet: string | null;
}

export interface NormalizedCompanyProfile {
  accounts: {
    nextAccountsDueOn: string | null;
    nextAccountsMadeUpTo: string | null;
    overdue: boolean | null;
  };
  companyName: string | null;
  companyNumber: string | null;
  companyStatus: string | null;
  companyStatusDetail: string | null;
  confirmationStatement: {
    nextDueOn: string | null;
    nextMadeUpTo: string | null;
    overdue: boolean | null;
  };
  dateOfCessation: string | null;
  dateOfCreation: string | null;
  hasCharges: boolean | null;
  hasInsolvencyHistory: boolean | null;
  jurisdiction: string | null;
  previousCompanyNames: Array<{
    ceasedOn: string | null;
    effectiveFrom: string | null;
    name: string | null;
  }>;
  registeredOfficeAddress: NormalizedAddress | null;
  sicCodes: string[];
  subtype: string | null;
  type: string | null;
}

export interface NormalizedOfficer {
  address: NormalizedAddress | null;
  appointedOn: string | null;
  countryOfResidence: string | null;
  dateOfBirth: NormalizedDateOfBirth | null;
  name: string | null;
  nationality: string | null;
  occupation: string | null;
  officerRole: string | null;
  personNumber: string | null;
  principalOfficeAddress: NormalizedAddress | null;
  resignedOn: string | null;
  responsibilities: string | null;
}

export interface NormalizedFiling {
  category: string | null;
  date: string | null;
  documentContentUrl: string | null;
  description: string | null;
  documentMetadataUrl: string | null;
  pages: number | null;
  paperFiled: boolean | null;
  subcategory: string | null;
  transactionId: string | null;
  type: string | null;
}

export interface NormalizedPsc {
  address: NormalizedAddress | null;
  ceased: boolean | null;
  ceasedOn: string | null;
  countryOfResidence: string | null;
  dateOfBirth: NormalizedDateOfBirth | null;
  description: string | null;
  identification: {
    countryRegistered: string | null;
    legalAuthority: string | null;
    legalForm: string | null;
    placeRegistered: string | null;
    registrationNumber: string | null;
  } | null;
  isSanctioned: boolean | null;
  kind: string | null;
  name: string | null;
  nationality: string | null;
  naturesOfControl: string[];
  notifiedOn: string | null;
  principalOfficeAddress: NormalizedAddress | null;
}

export interface NormalizedOfficerAppointment {
  appointedOn: string | null;
  companyName: string | null;
  companyNumber: string | null;
  companyStatus: string | null;
  countryOfResidence: string | null;
  name: string | null;
  nationality: string | null;
  occupation: string | null;
  officerRole: string | null;
  principalOfficeAddress: NormalizedAddress | null;
  resignedOn: string | null;
  responsibilities: string | null;
}

export interface NormalizedPersonSearchResult {
  address: NormalizedAddress | null;
  appointmentCount: number | null;
  appointments: NormalizedOfficerAppointment[];
  dateOfBirth: NormalizedDateOfBirth | null;
  description: string | null;
  descriptionIdentifiers: string[];
  name: string | null;
  officerId: string | null;
}

export interface NormalizedCharge {
  acquiredOn: string | null;
  briefDescription: string | null;
  chargeCode: string | null;
  chargeNumber: number | null;
  classification: string | null;
  createdOn: string | null;
  deliveredOn: string | null;
  moreThanFourPersonsEntitled: boolean | null;
  personsEntitled: string[];
  resolvedOn: string | null;
  satisfiedOn: string | null;
  status: string | null;
  type: string | null;
}

export interface NormalizedInsolvencyCase {
  caseDates: Array<{
    date: string | null;
    type: string | null;
  }>;
  notes: string[];
  number: string | null;
  practitioners: Array<{
    address: NormalizedAddress | null;
    appointedOn: string | null;
    ceasedToActOn: string | null;
    name: string | null;
    role: string | null;
  }>;
  type: string | null;
}

export type SearchCompaniesEnvelope = CommandEnvelope<
  {
    query: string;
    restrictions: string | null;
  },
  {
    companies: NormalizedCompanySearchResult[];
  }
>;

export type CompanyInfoEnvelope = CommandEnvelope<
  {
    companyNumber: string;
  },
  {
    company: NormalizedCompanyProfile;
  }
>;

export type OfficersEnvelope = CommandEnvelope<
  {
    companyNumber: string;
    orderBy: string | null;
    registerType: string | null;
    registerView: string | null;
  },
  {
    officers: NormalizedOfficer[];
    summary: {
      activeCount: number | null;
      resignedCount: number | null;
    };
  }
>;

export type FilingsEnvelope = CommandEnvelope<
  {
    category: string | null;
    companyNumber: string;
    includeLinks: boolean;
  },
  {
    filings: NormalizedFiling[];
  }
>;

export type PscEnvelope = CommandEnvelope<
  {
    companyNumber: string;
    registerView: string | null;
  },
  {
    psc: NormalizedPsc[];
    summary: {
      activeCount: number | null;
      ceasedCount: number | null;
    };
  }
>;

export type SearchPeopleEnvelope = CommandEnvelope<
  {
    matchLimit: number;
    query: string;
  },
  {
    results: NormalizedPersonSearchResult[];
    totalSearchHits: number | null;
  }
>;

export type ChargesEnvelope = CommandEnvelope<
  {
    companyNumber: string;
  },
  {
    charges: NormalizedCharge[];
    summary: {
      partSatisfiedCount: number | null;
      satisfiedCount: number | null;
      totalCount: number | null;
      unfilteredCount: number | null;
    };
  }
>;

export type InsolvencyEnvelope = CommandEnvelope<
  {
    companyNumber: string;
  },
  {
    cases: NormalizedInsolvencyCase[];
    status: string | null;
  }
>;
