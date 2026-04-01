import {
  Database,
  Globe2,
  GraduationCap,
  ShieldCheck,
  Users,
  Droplet,
  TrendingDown,
  Map,
} from "lucide-react";
import Image from "next/image";

const techStack = [
  {
    title: "Frontend",
    items: ["Next.js", "Tailwind CSS", "React Leaflet", "Recharts"],
    icon: Globe2,
  },
  {
    title: "Backend",
    items: ["Flask", "REST API", "Authentication", "Admin Process Control"],
    icon: ShieldCheck,
  },
  {
    title: "Geospasial & Data",
    items: [
      "GeoPandas",
      "RasterStats",
      "GeoJSON / GPKG / CSV",
      "File-based geospatial pipeline",
    ],
    icon: Database,
  },
];

const developers = [
  "Thezar Rifqi Izaati",
  "Aletha Nur Fatimah Siswandi Putri",
  "Elicia Hardiyanti",
  "Sonny Okandra Rusman",
  "Andhika Prasetya Adi Nugroho",
];

const supervisors = [
  "Dr. Riantini Virtriana, S.T., M.T.",
  "Prof. Dr. Irwan Meilano, S.T., M.Sc.",
  "Dr. Ir. Irwan Gumilar, S.T., M.Si.",
];

const partnerCards = [
  {
    name: "Kementerian Keuangan Republik Indonesia",
    short: "Kemenkeu",
    logo: "/partners/kemenkeu.png",
  },
  {
    name: "Badan Pusat Statistik Indonesia",
    short: "BPS",
    logo: "/partners/bps.png",
  },
  {
    name: "Kementerian Pertanian Republik Indonesia",
    short: "Kementan",
    logo: "/partners/kementan.svg",
  },
  {
    name: "Badan Nasional Penanggulangan Bencana",
    short: "BNPB",
    logo: "/partners/bnpb.png",
  },
  {
    name: "Badan Penanggulangan Bencana Daerah",
    short: "BPBD",
    logo: "/partners/bpbd.png",
  },
  {
    name: "PT Reasuransi Nasional Indonesia",
    short: "RNI",
    logo: "/partners/rni.png",
  },
];

function SectionHeader({
  title,
  desc,
  centered = true,
}: {
  title: string;
  desc?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <h2 className="text-heading text-balance text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      {desc ? (
        <p className="text-muted mt-3 leading-relaxed md:text-base">{desc}</p>
      ) : null}
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <section className="section-gradient-primary relative overflow-hidden text-white">
        <div className="section-container relative py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="badge badge-secondary">Tentang PADIS</span>

            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl text-[var(--color-secondary)]">
              Paddy Disaster Information System
            </h1>

            <p className="mt-5 text-lg leading-relaxed text-blue-100 md:text-xl">
              PADIS adalah platform web berbasis sistem informasi geospasial
              yang membantu analisis dampak banjir, kekeringan, dan
              multi-hazard terhadap kerugian padi secara terstruktur dan
              informatif.
            </p>
          </div>
        </div>
      </section>

      <section className="section-shell-tight -mt-6 rounded-t-[2rem] bg-slate-100 pt-10 pb-14 text-gray-900">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            <SectionHeader title="Apa yang Dilakukan PADIS" centered={true} />

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Hazard",
                  desc: "PADIS mengolah informasi banjir, kekeringan, dan multi-hazard sebagai dasar analisis risiko pada lahan padi.",
                  icon: Droplet,
                },
                {
                  title: "Kerugian",
                  desc: "Sistem ini menghubungkan hazard, kondisi iklim, dan data padi untuk menghasilkan informasi kerugian yang lebih terukur.",
                  icon: TrendingDown,
                },
                {
                  title: "Visualisasi",
                  desc: "Hasil analisis ditampilkan melalui WebGIS agar lebih mudah dipahami untuk evaluasi dan pengambilan keputusan.",
                  icon: Map,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md"
                  >
                    <div className="mb-3 inline-flex rounded-xl bg-[var(--color-primary-soft)] p-2">
                      <Icon className="h-4 w-4 text-[var(--color-primary)]" />
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell bg-white py-16 text-gray-900">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            <SectionHeader title="Teknologi PADIS" centered={true} />

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {techStack.map((group) => {
                const Icon = group.icon;
                return (
                  <div
                    key={group.title}
                    className="rounded-2xl border border-gray-200 bg-slate-50 p-5 transition hover:shadow-md"
                  >
                    <div className="mb-3 inline-flex rounded-xl bg-[var(--color-secondary-soft)] p-2">
                      <Icon className="h-4 w-4 text-[var(--color-secondary-dark)]" />
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900">
                      {group.title}
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-white px-3 py-1 text-sm text-gray-700 ring-1 ring-gray-200"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell bg-slate-50 py-12 text-gray-900">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Tim Capstone Project: {" "}
                <span className="text-[var(--color-primary)]">
                   PADIS
                </span>
              </h2>
            </div>

            <div className="mt-4 flex flex-col items-center justify-center gap-2 text-center md:flex-row md:text-left">
              <img
                src="/itb/itb.png"
                alt="Logo ITB"
                className="h-9 w-auto"
              />

              <div>
                <p className="text-sm font-medium text-gray-800">
                  Program Studi Teknik Geodesi dan Geomatika
                </p>
                <p className="text-sm text-gray-600">
                  Fakultas Ilmu dan Teknologi Kebumian · Institut Teknologi Bandung
                </p>
              </div>
            </div>

            <div className="mx-auto mt-5 h-px w-20 bg-slate-300" />

            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--color-primary)]" />
                  <h3 className="text-base font-semibold text-gray-900">
                    Pengembang
                  </h3>
                </div>

                <ul className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                  {developers.map((item) => (
                    <li
                      key={item}
                      className="text-sm leading-relaxed text-gray-600"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-[var(--color-secondary-dark)]" />
                  <h3 className="text-base font-semibold text-gray-900">
                    Pembimbing
                  </h3>
                </div>

                <ul className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                  {supervisors.map((item) => (
                    <li
                      key={item}
                      className="text-sm leading-relaxed text-gray-600"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell bg-gradient-to-b from-white to-slate-100 py-16 text-gray-900">
        <div className="section-container">
          <SectionHeader
            title="Mitra Kolaborasi"
            desc="PADIS dikembangkan dalam kolaborasi lintas institusi yang mendukung analisis risiko, data, dan pengambilan keputusan."
          />

          <div className="relative mt-8 overflow-hidden">
            <div className="partner-fade-left pointer-events-none absolute left-0 top-0 z-10 h-full w-16" />
            <div className="partner-fade-right pointer-events-none absolute right-0 top-0 z-10 h-full w-16" />

            <div className="partner-marquee">
              <div className="partner-track">
                {[...partnerCards, ...partnerCards].map((item, index) => (
                  <div
                    key={`${item.short}-${index}`}
                    className="group mx-3 flex min-w-[220px] max-w-[220px] flex-col items-center rounded-3xl border border-gray-200 bg-slate-50 px-5 py-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-gray-200 bg-white p-3">
                      {item.logo ? (
                        <Image
                          src={item.logo}
                          alt={item.short}
                          width={64}
                          height={64}
                          className="h-full w-full object-contain opacity-90 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
                        />
                      ) : (
                        <span className="text-sm font-bold text-[var(--color-primary)]">
                          {item.short}
                        </span>
                      )}
                    </div>

                    <p className="mt-4 text-sm font-semibold text-gray-900">
                      {item.short}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      {item.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

     <section className="section-shell bg-white py-14 text-gray-900">
      <div className="section-container">
        <div className="mx-auto max-w-3xl text-center">

          {/* Logo PADIS */}
          <img
            src="/logo/padis.svg"
            alt="Logo PADIS"
            className="mx-auto h-12 w-auto opacity-90"
          />

          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            Semoga {" "}
            <span className="text-[var(--color-primary)]">
                   PADIS 
            </span>
            {" "} Membantu!
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
            PADIS dikembangkan untuk mendukung analisis risiko pertanian yang lebih
            terstruktur, transparan, dan berbasis data spasial. Sistem ini diharapkan
            dapat membantu pemangku kepentingan dalam memahami dampak bencana,
            merencanakan mitigasi, serta meningkatkan kualitas pengambilan keputusan.
          </p>

        </div>
      </div>
    </section>
    </>
  );
}