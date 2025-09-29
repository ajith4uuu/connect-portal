import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

interface LanguageSwitcherProps {
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  currentLanguage,
  onLanguageChange
}) => {
  const { t } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇨🇦' },
    { code: 'fr', name: 'Français', flag: '🇨🇦' }
  ];

  return (
    <div className="language-switcher">
      <select 
        value={currentLanguage} 
        onChange={(e) => onLanguageChange(e.target.value)}
        className="language-select"
        aria-label={t('select_language')}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;