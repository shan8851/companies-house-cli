import type {
  AddressApi,
  ChargeApiItem,
  CompanyInsolvencyApiResponse,
  CompanyProfileApiResponse,
  CompanySearchApiItem,
  FilingHistoryApiItem,
  InsolvencyCaseApi,
  InsolvencyPractitionerApi,
  OfficerApiItem,
  OfficerAppointmentApiItem,
  OfficerSearchApiItem,
  PscApiItem
} from "../types/api.js";
import type {
  NormalizedAddress,
  NormalizedCharge,
  NormalizedCompanyProfile,
  NormalizedCompanySearchResult,
  NormalizedDateOfBirth,
  NormalizedFiling,
  NormalizedInsolvencyCase,
  NormalizedOfficer,
  NormalizedOfficerAppointment,
  NormalizedPersonSearchResult,
  NormalizedPsc
} from "../types/normalized.js";

const DOCUMENT_API_BASE_URL = "https://document-api.company-information.service.gov.uk";

const toNullableString = (value: string | undefined): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const toNullableBoolean = (value: boolean | undefined): boolean | null =>
  typeof value === "boolean" ? value : null;

const toNullableNumber = (value: number | undefined): number | null =>
  typeof value === "number" ? value : null;

const compactStrings = (values: Array<string | null>): string[] =>
  values.filter((value): value is string => value !== null);

export const normalizeAddress = (address: AddressApi | undefined): NormalizedAddress | null => {
  if (!address) {
    return null;
  }

  const normalizedAddress: NormalizedAddress = {
    addressLine1: toNullableString(address.address_line_1),
    addressLine2: toNullableString(address.address_line_2),
    careOf: toNullableString(address.care_of),
    country: toNullableString(address.country),
    formatted: null,
    locality: toNullableString(address.locality),
    poBox: toNullableString(address.po_box),
    postalCode: toNullableString(address.postal_code),
    premises: toNullableString(address.premises),
    region: toNullableString(address.region)
  };

  const formattedParts = compactStrings([
    normalizedAddress.careOf,
    normalizedAddress.poBox,
    normalizedAddress.premises,
    normalizedAddress.addressLine1,
    normalizedAddress.addressLine2,
    normalizedAddress.locality,
    normalizedAddress.region,
    normalizedAddress.postalCode,
    normalizedAddress.country
  ]);

  return {
    ...normalizedAddress,
    formatted: formattedParts.length > 0 ? formattedParts.join(", ") : null
  };
};

export const normalizeDateOfBirth = (
  dateOfBirth:
    | {
        day?: number;
        month?: number;
        year?: number;
      }
    | undefined
): NormalizedDateOfBirth | null => {
  if (!dateOfBirth) {
    return null;
  }

  const day = toNullableNumber(dateOfBirth.day);
  const month = toNullableNumber(dateOfBirth.month);
  const year = toNullableNumber(dateOfBirth.year);
  const formattedParts = compactStrings([
    day !== null ? String(day).padStart(2, "0") : null,
    month !== null ? String(month).padStart(2, "0") : null,
    year !== null ? String(year) : null
  ]);

  return {
    day,
    formatted: formattedParts.length > 0 ? formattedParts.join("/") : null,
    month,
    year
  };
};

export const normalizeCompanySearchResult = (
  item: CompanySearchApiItem
): NormalizedCompanySearchResult => ({
  address: normalizeAddress(item.address),
  companyNumber: toNullableString(item.company_number),
  companyStatus: toNullableString(item.company_status),
  companyType: toNullableString(item.company_type),
  dateOfCessation: toNullableString(item.date_of_cessation),
  dateOfCreation: toNullableString(item.date_of_creation),
  description: toNullableString(item.description),
  descriptionIdentifiers: item.description_identifier ?? [],
  name: toNullableString(item.title),
  snippet: toNullableString(item.snippet)
});

export const normalizeCompanyProfile = (
  profile: CompanyProfileApiResponse
): NormalizedCompanyProfile => ({
  accounts: {
    nextAccountsDueOn: toNullableString(profile.accounts?.next_due),
    nextAccountsMadeUpTo: toNullableString(profile.accounts?.next_made_up_to),
    overdue: toNullableBoolean(profile.accounts?.overdue)
  },
  companyName: toNullableString(profile.company_name),
  companyNumber: toNullableString(profile.company_number),
  companyStatus: toNullableString(profile.company_status),
  companyStatusDetail: toNullableString(profile.company_status_detail),
  confirmationStatement: {
    nextDueOn: toNullableString(profile.confirmation_statement?.next_due),
    nextMadeUpTo: toNullableString(profile.confirmation_statement?.next_made_up_to),
    overdue: toNullableBoolean(profile.confirmation_statement?.overdue)
  },
  dateOfCessation: toNullableString(profile.date_of_cessation),
  dateOfCreation: toNullableString(profile.date_of_creation),
  hasCharges: toNullableBoolean(profile.has_charges),
  hasInsolvencyHistory: toNullableBoolean(profile.has_insolvency_history),
  jurisdiction: toNullableString(profile.jurisdiction),
  previousCompanyNames:
    profile.previous_company_names?.map((previousCompanyName) => ({
      ceasedOn: toNullableString(previousCompanyName.ceased_on),
      effectiveFrom: toNullableString(previousCompanyName.effective_from),
      name: toNullableString(previousCompanyName.name)
    })) ?? [],
  registeredOfficeAddress: normalizeAddress(profile.registered_office_address),
  sicCodes: profile.sic_codes ?? [],
  subtype: toNullableString(profile.subtype),
  type: toNullableString(profile.type)
});

export const normalizeOfficer = (item: OfficerApiItem): NormalizedOfficer => ({
  address: normalizeAddress(item.address),
  appointedOn: toNullableString(item.appointed_on),
  countryOfResidence: toNullableString(item.country_of_residence),
  dateOfBirth: normalizeDateOfBirth(item.date_of_birth),
  name: toNullableString(item.name),
  nationality: toNullableString(item.nationality),
  occupation: toNullableString(item.occupation),
  officerRole: toNullableString(item.officer_role),
  personNumber: toNullableString(item.person_number),
  principalOfficeAddress: normalizeAddress(item.principal_office_address),
  resignedOn: toNullableString(item.resigned_on),
  responsibilities: toNullableString(item.responsibilities)
});

const toDocumentContentUrl = (
  documentMetadataUrl: string | null,
  includeLinks: boolean
): string | null => {
  if (!includeLinks || documentMetadataUrl === null) {
    return null;
  }

  if (documentMetadataUrl.startsWith("http://") || documentMetadataUrl.startsWith("https://")) {
    return documentMetadataUrl.endsWith("/content")
      ? documentMetadataUrl
      : `${documentMetadataUrl}/content`;
  }

  const normalizedPath = documentMetadataUrl.startsWith("/")
    ? documentMetadataUrl
    : `/${documentMetadataUrl}`;
  const contentPath = normalizedPath.endsWith("/content")
    ? normalizedPath
    : `${normalizedPath}/content`;

  return new URL(contentPath, DOCUMENT_API_BASE_URL).toString();
};

export const normalizeFiling = (
  item: FilingHistoryApiItem,
  options?: {
    includeLinks?: boolean;
  }
): NormalizedFiling => {
  const documentMetadataUrl = toNullableString(item.links?.document_metadata);

  return {
    category: toNullableString(item.category),
    date: toNullableString(item.date),
    description: toNullableString(item.description),
    documentContentUrl: toDocumentContentUrl(
      documentMetadataUrl,
      options?.includeLinks ?? false
    ),
    documentMetadataUrl,
    pages: toNullableNumber(item.pages),
    paperFiled: toNullableBoolean(item.paper_filed),
    subcategory: toNullableString(item.subcategory),
    transactionId: toNullableString(item.transaction_id),
    type: toNullableString(item.type)
  };
};

export const normalizePsc = (item: PscApiItem): NormalizedPsc => ({
  address: normalizeAddress(item.address),
  ceased: toNullableBoolean(item.ceased),
  ceasedOn: toNullableString(item.ceased_on),
  countryOfResidence: toNullableString(item.country_of_residence),
  dateOfBirth: normalizeDateOfBirth(item.date_of_birth),
  description: toNullableString(item.description),
  identification: item.identification
    ? {
        countryRegistered: toNullableString(item.identification.country_registered),
        legalAuthority: toNullableString(item.identification.legal_authority),
        legalForm: toNullableString(item.identification.legal_form),
        placeRegistered: toNullableString(item.identification.place_registered),
        registrationNumber: toNullableString(item.identification.registration_number)
      }
    : null,
  isSanctioned: toNullableBoolean(item.is_sanctioned),
  kind: toNullableString(item.kind),
  name: toNullableString(item.name),
  nationality: toNullableString(item.nationality),
  naturesOfControl: item.natures_of_control ?? [],
  notifiedOn: toNullableString(item.notified_on),
  principalOfficeAddress: normalizeAddress(item.principal_office_address)
});

export const extractOfficerId = (selfLink: string | undefined): string | null => {
  if (typeof selfLink !== "string") {
    return null;
  }

  const match = selfLink.match(/\/officers\/([^/]+)/);

  return match?.[1] ?? null;
};

export const normalizeOfficerAppointment = (
  item: OfficerAppointmentApiItem
): NormalizedOfficerAppointment => ({
  appointedOn: toNullableString(item.appointed_on),
  companyName: toNullableString(item.appointed_to?.company_name),
  companyNumber: toNullableString(item.appointed_to?.company_number),
  companyStatus: toNullableString(item.appointed_to?.company_status),
  countryOfResidence: toNullableString(item.country_of_residence),
  name: toNullableString(item.name),
  nationality: toNullableString(item.nationality),
  occupation: toNullableString(item.occupation),
  officerRole: toNullableString(item.officer_role),
  principalOfficeAddress: normalizeAddress(item.principal_office_address ?? item.address),
  resignedOn: toNullableString(item.resigned_on),
  responsibilities: toNullableString(item.responsibilities)
});

export const normalizePersonSearchResult = (
  item: OfficerSearchApiItem,
  appointments: NormalizedOfficerAppointment[]
): NormalizedPersonSearchResult => ({
  address: normalizeAddress(item.address),
  appointmentCount: toNullableNumber(item.appointment_count),
  appointments,
  dateOfBirth: normalizeDateOfBirth(item.date_of_birth),
  description: toNullableString(item.description),
  descriptionIdentifiers: item.description_identifiers ?? [],
  name: toNullableString(item.title),
  officerId: extractOfficerId(item.links?.self)
});

export const normalizeCharge = (item: ChargeApiItem): NormalizedCharge => ({
  acquiredOn: toNullableString(item.acquired_on),
  briefDescription: toNullableString(item.particulars?.brief_description),
  chargeCode: toNullableString(item.charge_code),
  chargeNumber: toNullableNumber(item.charge_number),
  classification: toNullableString(item.classification?.description),
  createdOn: toNullableString(item.created_on),
  deliveredOn: toNullableString(item.delivered_on),
  moreThanFourPersonsEntitled: toNullableBoolean(item.more_than_four_persons_entitled),
  personsEntitled:
    item.persons_entitled
      ?.map((personEntitled) => toNullableString(personEntitled.name))
      .filter((name): name is string => name !== null) ?? [],
  resolvedOn: toNullableString(item.resolved_on),
  satisfiedOn: toNullableString(item.satisfied_on),
  status: toNullableString(item.status),
  type: toNullableString(item.particulars?.type)
});

const normalizeInsolvencyPractitioner = (
  practitioner: InsolvencyPractitionerApi
): NormalizedInsolvencyCase["practitioners"][number] => ({
  address: normalizeAddress(practitioner.address),
  appointedOn: toNullableString(practitioner.appointed_on),
  ceasedToActOn: toNullableString(practitioner.ceased_to_act_on),
  name: toNullableString(practitioner.name),
  role: toNullableString(practitioner.role)
});

export const normalizeInsolvencyCase = (
  insolvencyCase: InsolvencyCaseApi
): NormalizedInsolvencyCase => ({
  caseDates:
    insolvencyCase.dates?.map((caseDate) => ({
      date: toNullableString(caseDate.date),
      type: toNullableString(caseDate.type)
    })) ?? [],
  notes: insolvencyCase.notes ?? [],
  number: toNullableString(insolvencyCase.number),
  practitioners:
    insolvencyCase.practitioners?.map(normalizeInsolvencyPractitioner) ?? [],
  type: toNullableString(insolvencyCase.type)
});

export const normalizeInsolvencyCases = (
  insolvency: CompanyInsolvencyApiResponse | null
): NormalizedInsolvencyCase[] => insolvency?.cases?.map(normalizeInsolvencyCase) ?? [];
