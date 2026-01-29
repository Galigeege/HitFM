import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ApiKeyContextType {
    apiKey: string;
    setApiKey: (key: string) => void;
    hasKey: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [apiKey, setApiKeyState] = useState<string>(() => {
        return process.env.GEMINI_API_KEY || localStorage.getItem('hitfm_gemini_key') || '';
    });

    const setApiKey = (key: string) => {
        setApiKeyState(key);
        if (key) {
            localStorage.setItem('hitfm_gemini_key', key);
        } else {
            localStorage.removeItem('hitfm_gemini_key');
        }
    };

    return (
        <ApiKeyContext.Provider value={{ apiKey, setApiKey, hasKey: !!apiKey }}>
            {children}
        </ApiKeyContext.Provider>
    );
};

export const useApiKey = () => {
    const context = useContext(ApiKeyContext);
    if (context === undefined) {
        throw new Error('useApiKey must be used within an ApiKeyProvider');
    }
    return context;
};
