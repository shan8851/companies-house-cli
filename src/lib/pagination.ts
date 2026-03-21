import type { ApiListResponse } from "../types/api.js";
import type { ListCommandOptions, PaginationMeta } from "../types/cli.js";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_ALL_PAGE_SIZE = 100;

export interface FetchPaginatedItemsOptions<TItem, TResponse extends ApiListResponse<TItem>> {
  fetchPage: (page: {
    itemsPerPage: number;
    startIndex: number;
  }) => Promise<TResponse>;
  options: ListCommandOptions;
}

export interface FetchPaginatedItemsResult<TItem> {
  items: TItem[];
  pagination: PaginationMeta;
}

const getTotalResults = <TItem>(response: ApiListResponse<TItem>): number | null =>
  response.total_results ?? response.total_count ?? null;

const getStartIndex = <TItem>(response: ApiListResponse<TItem>): number =>
  response.start_index ?? 0;

const getItemsPerPage = <TItem>(
  response: ApiListResponse<TItem>,
  fallbackItemsPerPage: number,
  pageItemCount: number
): number => response.items_per_page ?? fallbackItemsPerPage ?? pageItemCount;

export const fetchPaginatedItems = async <TItem, TResponse extends ApiListResponse<TItem>>({
  fetchPage,
  options
}: FetchPaginatedItemsOptions<TItem, TResponse>): Promise<FetchPaginatedItemsResult<TItem>> => {
  const all = options.all ?? false;
  const startIndex = options.startIndex ?? 0;
  const requestedItemsPerPage = options.itemsPerPage;
  const effectiveItemsPerPage = all
    ? requestedItemsPerPage ?? DEFAULT_ALL_PAGE_SIZE
    : requestedItemsPerPage ?? DEFAULT_PAGE_SIZE;

  const firstPage = await fetchPage({
    itemsPerPage: effectiveItemsPerPage,
    startIndex
  });
  const firstItems = firstPage.items ?? [];

  if (!all) {
    return {
      items: firstItems,
      pagination: {
        fetchedAll: false,
        itemsPerPage: effectiveItemsPerPage,
        returnedCount: firstItems.length,
        startIndex,
        totalResults: getTotalResults(firstPage)
      }
    };
  }

  const collectedItems = [...firstItems];
  let totalResults = getTotalResults(firstPage);
  let currentStartIndex =
    getStartIndex(firstPage) +
    getItemsPerPage(firstPage, effectiveItemsPerPage, firstItems.length);
  let lastPageItemCount = firstItems.length;

  while (lastPageItemCount > 0) {
    if (totalResults !== null && collectedItems.length >= totalResults) {
      break;
    }

    const page = await fetchPage({
      itemsPerPage: effectiveItemsPerPage,
      startIndex: currentStartIndex
    });
    const pageItems = page.items ?? [];

    if (pageItems.length === 0) {
      break;
    }

    collectedItems.push(...pageItems);
    totalResults = totalResults ?? getTotalResults(page);
    lastPageItemCount = pageItems.length;
    currentStartIndex =
      getStartIndex(page) + getItemsPerPage(page, effectiveItemsPerPage, pageItems.length);
  }

  return {
    items: collectedItems,
    pagination: {
      fetchedAll: true,
      itemsPerPage: effectiveItemsPerPage,
      returnedCount: collectedItems.length,
      startIndex,
      totalResults
    }
  };
};
