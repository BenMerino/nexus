import { useState, useEffect } from 'react';

export function useTheme() {
    const [isDark, setIsDark] = useState(() => {
        if (typeof window === 'undefined') return false;
        return document.documentElement.classList.contains('dark');
    });

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    return isDark;
}
