import type {
  ChargeListApiResponse,
  CompanyInsolvencyApiResponse,
  CompanyProfileApiResponse,
  CompanySearchApiResponse,
  FilingHistoryApiResponse,
  OfficerAppointmentListApiResponse,
  OfficerListApiResponse,
  OfficerSearchApiResponse,
  PscListApiResponse
} from "../types/api.js";
import { CompaniesHouseCliError } from "./errors.js";

const USER_AGENT = "companies-house-cli/0.1.0";

type QueryValue = number | string | undefined;

export interface CompaniesHouseClientOptions {
  apiKey: string;
  baseUrl: string;
  fetchImplementation: typeof fetch;
}

export interface PaginatedApiRequest {
  itemsPerPage?: number;
  startIndex?: number;
}

export interface SearchCompaniesRequest extends PaginatedApiRequest {
  query: string;
  restrictions?: string;
}

export interface ListOfficersRequest extends PaginatedApiRequest {
  companyNumber: string;
  orderBy?: string;
  registerType?: string;
  registerView?: string;
}

export interface ListFilingsRequest extends PaginatedApiRequest {
  category?: string;
  companyNumber: string;
}

export interface ListPscRequest extends PaginatedApiRequest {
  companyNumber: string;
  registerView?: string;
}

export interface SearchOfficersRequest extends PaginatedApiRequest {
  query: string;
}

export interface ListOfficerAppointmentsRequest extends PaginatedApiRequest {
  officerId: string;
}

export interface ListChargesRequest extends PaginatedApiRequest {
  companyNumber: string;
}

const safeParseJson = (text: string): unknown => {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const buildUrl = (
  baseUrl: string,
  path: string,
  query: Record<string, QueryValue>
): URL => {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBaseUrl);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url;
};

const createApiError = (
  statusCode: number,
  url: string,
  responseBody: unknown
): CompaniesHouseCliError => {
  if (statusCode === 401) {
    return new CompaniesHouseCliError(
      "Companies House rejected the request. Check that COMPANIES_HOUSE_API_KEY is valid for the public data API.",
      "unauthorized",
      statusCode
    );
  }

  if (statusCode === 404) {
    return new CompaniesHouseCliError(
      "The requested Companies House resource was not found.",
      "not_found",
      statusCode
    );
  }

  if (statusCode === 429) {
    return new CompaniesHouseCliError(
      "Companies House rate-limited the request. Wait a moment and try again.",
      "rate_limited",
      statusCode
    );
  }

  const message =
    typeof responseBody === "object" &&
    responseBody !== null &&
    "error" in responseBody &&
    typeof responseBody.error === "string"
      ? responseBody.error
      : `Companies House returned HTTP ${statusCode} for ${url}.`;

  return new CompaniesHouseCliError(message, "api_error", statusCode);
};

export interface CompaniesHouseClient {
  getCompanyProfile: (companyNumber: string) => Promise<CompanyProfileApiResponse>;
  getInsolvency: (companyNumber: string) => Promise<CompanyInsolvencyApiResponse | null>;
  listCharges: (request: ListChargesRequest) => Promise<ChargeListApiResponse>;
  listFilings: (request: ListFilingsRequest) => Promise<FilingHistoryApiResponse>;
  listOfficerAppointments: (
    request: ListOfficerAppointmentsRequest
  ) => Promise<OfficerAppointmentListApiResponse>;
  listOfficers: (request: ListOfficersRequest) => Promise<OfficerListApiResponse>;
  listPsc: (request: ListPscRequest) => Promise<PscListApiResponse>;
  searchCompanies: (request: SearchCompaniesRequest) => Promise<CompanySearchApiResponse>;
  searchOfficers: (request: SearchOfficersRequest) => Promise<OfficerSearchApiResponse>;
}

export const createCompaniesHouseClient = ({
  apiKey,
  baseUrl,
  fetchImplementation
}: CompaniesHouseClientOptions): CompaniesHouseClient => {
  const authorizationHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;

  const requestJson = async <T>(
    path: string,
    query: Record<string, QueryValue>,
    options?: {
      allowNotFound?: boolean;
    }
  ): Promise<T | null> => {
    const url = buildUrl(baseUrl, path, query);

    let response: Response;

    try {
      response = await fetchImplementation(url, {
        headers: {
          Accept: "application/json",
          Authorization: authorizationHeader,
          "User-Agent": USER_AGENT
        }
      });
    } catch (error) {
      throw new CompaniesHouseCliError(
        error instanceof Error
          ? `Failed to reach Companies House: ${error.message}`
          : "Failed to reach Companies House.",
        "network_error"
      );
    }

    const responseText = await response.text();
    const responseBody = safeParseJson(responseText);

    if (response.status === 404 && options?.allowNotFound) {
      return null;
    }

    if (!response.ok) {
      throw createApiError(response.status, url.toString(), responseBody);
    }

    if (typeof responseBody !== "object" || responseBody === null) {
      throw new CompaniesHouseCliError(
        `Companies House returned an invalid JSON payload for ${url.toString()}.`,
        "invalid_response"
      );
    }

    return responseBody as T;
  };

  return {
    getCompanyProfile: async (companyNumber) =>
      (await requestJson<CompanyProfileApiResponse>(
        `/company/${companyNumber}`,
        {}
      )) as CompanyProfileApiResponse,
    getInsolvency: async (companyNumber) =>
      await requestJson<CompanyInsolvencyApiResponse>(
        `/company/${companyNumber}/insolvency`,
        {},
        {
          allowNotFound: true
        }
      ),
    listCharges: async ({ companyNumber, itemsPerPage, startIndex }) =>
      (await requestJson<ChargeListApiResponse>(
        `/company/${companyNumber}/charges`,
        {
          items_per_page: itemsPerPage,
          start_index: startIndex
        }
      )) as ChargeListApiResponse,
    listFilings: async ({ category, companyNumber, itemsPerPage, startIndex }) =>
      (await requestJson<FilingHistoryApiResponse>(
        `/company/${companyNumber}/filing-history`,
        {
          category,
          items_per_page: itemsPerPage,
          start_index: startIndex
        }
      )) as FilingHistoryApiResponse,
    listOfficerAppointments: async ({ officerId, itemsPerPage, startIndex }) =>
      (await requestJson<OfficerAppointmentListApiResponse>(
        `/officers/${officerId}/appointments`,
        {
          items_per_page: itemsPerPage,
          start_index: startIndex
        }
      )) as OfficerAppointmentListApiResponse,
    listOfficers: async ({
      companyNumber,
      itemsPerPage,
      orderBy,
      registerType,
      registerView,
      startIndex
    }) =>
      (await requestJson<OfficerListApiResponse>(
        `/company/${companyNumber}/officers`,
        {
          items_per_page: itemsPerPage,
          order_by: orderBy,
          register_type: registerType,
          register_view: registerView,
          start_index: startIndex
        }
      )) as OfficerListApiResponse,
    listPsc: async ({ companyNumber, itemsPerPage, registerView, startIndex }) =>
      (await requestJson<PscListApiResponse>(
        `/company/${companyNumber}/persons-with-significant-control`,
        {
          items_per_page: itemsPerPage,
          register_view: registerView,
          start_index: startIndex
        }
      )) as PscListApiResponse,
    searchCompanies: async ({ itemsPerPage, query, restrictions, startIndex }) =>
      (await requestJson<CompanySearchApiResponse>("/search/companies", {
        items_per_page: itemsPerPage,
        q: query,
        restrictions,
        start_index: startIndex
      })) as CompanySearchApiResponse,
    searchOfficers: async ({ itemsPerPage, query, startIndex }) =>
      (await requestJson<OfficerSearchApiResponse>("/search/officers", {
        items_per_page: itemsPerPage,
        q: query,
        start_index: startIndex
      })) as OfficerSearchApiResponse
  };
};
