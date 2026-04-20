function getSafeStorageArea(areaName) {
    try {
        return window[areaName] || null;
    } catch (e) {
        return null;
    }
}

function clearAllData() {
    var localStorageArea;
    var sessionStorageArea;

    if (typeof addLoader === "function") {
        addLoader("refreshBtn");
    }

    try {
        if ("caches" in window && window.caches && typeof window.caches.keys === "function") {
            window.caches.keys().then(function (cacheNames) {
                var i;
                for (i = 0; i < cacheNames.length; i++) {
                    window.caches.delete(cacheNames[i]);
                }
            }).catch(function (error) {
                console.error("Failed to clear CacheStorage:", error);
            });
        }
    } catch (e) {
        console.error("Failed to clear CacheStorage:", e);
    }

    localStorageArea = getSafeStorageArea("localStorage");
    if (localStorageArea && typeof localStorageArea.clear === "function") {
        try {
            localStorageArea.clear();
        } catch (e) {
            console.error("Failed to clear localStorage:", e);
        }
    } else {
        console.error("localStorage is not supported in this browser.");
    }

    sessionStorageArea = getSafeStorageArea("sessionStorage");
    if (sessionStorageArea && typeof sessionStorageArea.clear === "function") {
        try {
            sessionStorageArea.clear();
        } catch (e) {
            console.error("Failed to clear sessionStorage:", e);
        }
    } else {
        console.error("sessionStorage is not supported in this browser.");
    }

    if (window.location && typeof window.location.reload === "function") {
        window.location.reload(true);
    }
}
