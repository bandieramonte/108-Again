type RouteParams = {
    confirmed?: string | string[];
};

function getFirstParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
}

export function shouldShowHeaderBack(
    pathname: string,
    canGoBack: boolean,
    params: RouteParams = {}
) {
    if (!canGoBack) return false;

    if (pathname === "/") {
        return false;
    }

    if (pathname === "/reset-password") {
        return false;
    }

    if (
        pathname === "/sign-in" &&
        getFirstParam(params.confirmed) === "true"
    ) {
        return false;
    }

    return true;
}
