// Turkish copy for the registration screen. Moves to next-intl messages in Step 3.
export const registrationCopy = {
  metaTitle: "Kayıt ol · Workly",
  prototypeBadge: "Prototip",

  brand: {
    headline: "Profesyonel yolculuğun burada başlıyor.",
    points: [
      "Tek kişisel hesap. Kariyerin boyunca seninle.",
      "İş e-postanı daha sonra ekleyebilirsin; ayrı bir hesap gerekmez.",
      "E-postanı doğruladıktan sonra paylaşım yapabilir, başvurabilir ve mesajlaşabilirsin.",
    ],
  },

  form: {
    title: "Workly'ye katıl",
    subtitle: "Tek bir kişisel hesapla başla.",
    requiredNote: "Zorunlu alan",
    email: {
      label: "E-posta",
      hint: "Kişisel e-posta adresini kullan. İş e-postanı şirket bağlantısı için daha sonra ekleyebilirsin.",
      errorEmpty: "E-posta adresini gir.",
      errorInvalid: "Geçerli bir e-posta adresi gir.",
    },
    password: {
      label: "Şifre",
      hint: "En az 8 karakter.",
      errorEmpty: "Bir şifre belirle.",
      errorTooShort: "Şifren en az 8 karakter olmalı.",
      showToggle: "Şifreyi göster",
    },
    errorSummaryTitle: "Bazı alanlar eksik veya hatalı",
    errorSummaryBody: "Lütfen işaretli alanları düzelt ve tekrar dene.",
    submit: "Hesap oluştur",
    submitting: "Hesap oluşturuluyor",
    // PLACEHOLDER: wording and documents need legal review (incl. KVKK)
    // before launch. The linked documents do not exist yet.
    legal: {
      before: "Devam ederek ",
      terms: "Kullanım Koşulları",
      middle: "'nı kabul etmiş ve ",
      privacy: "Aydınlatma Metni",
      after: "'ni okumuş olursun.",
    },
    // Plain text until the sign-in screen exists.
    signInPrompt: "Zaten hesabın var mı? Giriş yap",
  },

  success: {
    title: "E-postanı kontrol et",
    sentTo: (email: string) =>
      `Doğrulama bağlantısını ${email} adresine gönderdik.`,
    nextSteps:
      "E-postanı doğruladıktan sonra paylaşım yapabilir, iş ilanlarına başvurabilir ve mesajlaşabilirsin. Profilini dilediğin zaman tamamlayabilirsin.",
    prototypeNotice:
      "Prototip: Gerçek bir hesap oluşturulmadı ve e-posta gönderilmedi.",
    useDifferentEmail: "Farklı bir e-posta kullan",
  },
} as const;
