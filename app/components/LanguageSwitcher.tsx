type Props = {
  language: "en" | "my";
  setLanguage: (value: "en" | "my") => void;
};

export default function LanguageSwitcher({ language, setLanguage }: Props) {
  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as "en" | "my")}
      className="rounded-full border px-3 py-2"
    >
      <option value="en">EN</option>
      <option value="my">မြန်မာ</option>
    </select>
  );
}