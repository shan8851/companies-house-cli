export interface AddressApi {
  care_of?: string;
  country?: string;
  locality?: string;
  po_box?: string;
  postal_code?: string;
  premises?: string;
  region?: string;
  address_line_1?: string;
  address_line_2?: string;
}

export interface DateOfBirthApi {
  day?: number;
  month?: number;
  year?: number;
}

export interface LinksApi {
  self?: string;
  [key: string]: unknown;
}

export interface ApiListResponse<TItem> {
  items?: TItem[];
  items_per_page?: number;
  start_index?: number;
  total_count?: number;
  total_results?: number;
}

export interface CompanySearchMatchApi {
  address_snippet?: number[];
  snippet?: number[];
  title?: number[];
}

export interface CompanySearchApiItem {
  address?: AddressApi;
  company_number?: string;
  company_status?: string;
  company_type?: string;
  date_of_cessation?: string;
  date_of_creation?: string;
  description?: string;
  description_identifier?: string[];
  kind?: string;
  matches?: CompanySearchMatchApi;
  snippet?: string;
  title?: string;
}

export interface CompanySearchApiResponse extends ApiListResponse<CompanySearchApiItem> {
  kind?: string;
}

export interface CompanyProfileApiResponse {
  accounts?: {
    account_period_from?: string;
    account_period_to?: string;
    next_accounts?: {
      due_on?: string;
      overdue?: boolean;
      period_end_on?: string;
      period_start_on?: string;
    };
    next_due?: string;
    next_made_up_to?: string;
    overdue?: boolean;
  };
  company_name?: string;
  company_number?: string;
  company_status?: string;
  company_status_detail?: string;
  confirmation_statement?: {
    next_due?: string;
    next_made_up_to?: string;
    overdue?: boolean;
  };
  date_of_cessation?: string;
  date_of_creation?: string;
  external_registration_number?: string;
  foreign_company_details?: {
    accounting_requirement?: {
      foreign_account_type?: string;
      terms_of_account_publication?: string;
    };
    business_activity?: string;
    company_type?: string;
    governed_by?: string;
    is_a_credit_finance_institution?: boolean;
    origin_country?: string;
    place_registered?: string;
    registration_number?: string;
  };
  has_charges?: boolean;
  has_insolvency_history?: boolean;
  jurisdiction?: string;
  links?: LinksApi;
  partial_data_available?: string;
  previous_company_names?: Array<{
    ceased_on?: string;
    effective_from?: string;
    name?: string;
  }>;
  registered_office_address?: AddressApi;
  sic_codes?: string[];
  subtype?: string;
  type?: string;
}

export interface OfficerApiItem {
  address?: AddressApi;
  appointed_before?: string;
  appointed_on?: string;
  contact_details?: {
    contact_name?: string;
  };
  country_of_residence?: string;
  date_of_birth?: DateOfBirthApi;
  former_names?: Array<{
    forenames?: string;
    surname?: string;
  }>;
  links?: LinksApi;
  name?: string;
  nationality?: string;
  occupation?: string;
  officer_role?: string;
  person_number?: string;
  principal_office_address?: AddressApi;
  resigned_on?: string;
  responsibilities?: string;
}

export interface OfficerListApiResponse extends ApiListResponse<OfficerApiItem> {
  active_count?: number;
  etag?: string;
  kind?: string;
  links?: LinksApi;
  resigned_count?: number;
}

export interface FilingHistoryApiItem {
  category?: string;
  date?: string;
  description?: string;
  links?: {
    document_metadata?: string;
    self?: string;
    [key: string]: unknown;
  };
  pages?: number;
  paper_filed?: boolean;
  subcategory?: string;
  transaction_id?: string;
  type?: string;
}

export interface FilingHistoryApiResponse extends ApiListResponse<FilingHistoryApiItem> {
  filing_history_status?: string;
  kind?: string;
  total_count?: number;
}

export interface PscApiItem {
  address?: AddressApi;
  ceased?: boolean;
  ceased_on?: string;
  country_of_residence?: string;
  date_of_birth?: DateOfBirthApi;
  description?: string;
  etag?: string;
  identification?: {
    country_registered?: string;
    legal_authority?: string;
    legal_form?: string;
    place_registered?: string;
    registration_number?: string;
  };
  is_sanctioned?: boolean;
  kind?: string;
  links?: LinksApi;
  name?: string;
  nationality?: string;
  natures_of_control?: string[];
  notified_on?: string;
  principal_office_address?: AddressApi;
}

export interface PscListApiResponse extends ApiListResponse<PscApiItem> {
  active_count?: number;
  ceased_count?: number;
  links?: LinksApi;
  total_results?: number;
}

export interface OfficerSearchApiItem {
  address?: AddressApi;
  address_snippet?: string;
  appointment_count?: number;
  date_of_birth?: DateOfBirthApi;
  description?: string;
  description_identifiers?: string[];
  kind?: string;
  links?: LinksApi;
  matches?: CompanySearchMatchApi;
  snippet?: string;
  title?: string;
}

export interface OfficerSearchApiResponse extends ApiListResponse<OfficerSearchApiItem> {
  kind?: string;
}

export interface OfficerAppointmentApiItem {
  address?: AddressApi;
  appointed_on?: string;
  appointed_to?: {
    company_name?: string;
    company_number?: string;
    company_status?: string;
  };
  country_of_residence?: string;
  links?: LinksApi;
  name?: string;
  nationality?: string;
  occupation?: string;
  officer_role?: string;
  principal_office_address?: AddressApi;
  resigned_on?: string;
  responsibilities?: string;
}

export interface OfficerAppointmentListApiResponse
  extends ApiListResponse<OfficerAppointmentApiItem> {
  date_of_birth?: DateOfBirthApi;
  is_corporate_officer?: boolean;
  links?: LinksApi;
  name?: string;
  total_results?: number;
}

export interface ChargePersonEntitledApi {
  name?: string;
}

export interface ChargeParticularsApi {
  brief_description?: string;
  contains_fixed_charge?: boolean;
  contains_floating_charge?: boolean;
  floating_charge_covers_all?: boolean;
  type?: string;
}

export interface ChargeApiItem {
  acquired_on?: string;
  charge_code?: string;
  charge_number?: number;
  classification?: {
    description?: string;
    type?: string;
  };
  created_on?: string;
  delivered_on?: string;
  id?: string;
  more_than_four_persons_entitled?: boolean;
  particulars?: ChargeParticularsApi;
  persons_entitled?: ChargePersonEntitledApi[];
  resolved_on?: string;
  satisfied_on?: string;
  status?: string;
}

export interface ChargeListApiResponse extends ApiListResponse<ChargeApiItem> {
  part_satisfied_count?: number;
  satisfied_count?: number;
  total_count?: number;
  unfiletered_count?: number;
}

export interface InsolvencyCaseDateApi {
  date?: string;
  type?: string;
}

export interface InsolvencyPractitionerApi {
  address?: AddressApi;
  appointed_on?: string;
  ceased_to_act_on?: string;
  name?: string;
  role?: string;
}

export interface InsolvencyCaseApi {
  dates?: InsolvencyCaseDateApi[];
  notes?: string[];
  number?: string;
  practitioners?: InsolvencyPractitionerApi[];
  type?: string;
}

export interface CompanyInsolvencyApiResponse {
  cases?: InsolvencyCaseApi[];
  etag?: string;
  status?: string;
}
