// Every paginated dashboard table offers the same page-size picker and starts
// at the same size (the Hotels list is the reference). The backend validates
// and clamps `per_page` itself; these are only the choices the UI offers.
export const PER_PAGE_OPTIONS = [10, 15, 20]
export const DEFAULT_PER_PAGE = 10
