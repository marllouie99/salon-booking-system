// Philippine Cities and Provinces Data
const philippineLocations = {
    provinces: [
        // NCR (National Capital Region)
        { name: "Metro Manila", region: "NCR" },
        
        // Region I - Ilocos Region
        { name: "Ilocos Norte", region: "Region I" },
        { name: "Ilocos Sur", region: "Region I" },
        { name: "La Union", region: "Region I" },
        { name: "Pangasinan", region: "Region I" },
        
        // Region II - Cagayan Valley
        { name: "Batanes", region: "Region II" },
        { name: "Cagayan", region: "Region II" },
        { name: "Isabela", region: "Region II" },
        { name: "Nueva Vizcaya", region: "Region II" },
        { name: "Quirino", region: "Region II" },
        
        // Region III - Central Luzon
        { name: "Aurora", region: "Region III" },
        { name: "Bataan", region: "Region III" },
        { name: "Bulacan", region: "Region III" },
        { name: "Nueva Ecija", region: "Region III" },
        { name: "Pampanga", region: "Region III" },
        { name: "Tarlac", region: "Region III" },
        { name: "Zambales", region: "Region III" },
        
        // Region IV-A - CALABARZON
        { name: "Batangas", region: "Region IV-A" },
        { name: "Cavite", region: "Region IV-A" },
        { name: "Laguna", region: "Region IV-A" },
        { name: "Quezon", region: "Region IV-A" },
        { name: "Rizal", region: "Region IV-A" },
        
        // Region IV-B - MIMAROPA
        { name: "Marinduque", region: "Region IV-B" },
        { name: "Occidental Mindoro", region: "Region IV-B" },
        { name: "Oriental Mindoro", region: "Region IV-B" },
        { name: "Palawan", region: "Region IV-B" },
        { name: "Romblon", region: "Region IV-B" },
        
        // Region V - Bicol Region
        { name: "Albay", region: "Region V" },
        { name: "Camarines Norte", region: "Region V" },
        { name: "Camarines Sur", region: "Region V" },
        { name: "Catanduanes", region: "Region V" },
        { name: "Masbate", region: "Region V" },
        { name: "Sorsogon", region: "Region V" },
        
        // Region VI - Western Visayas
        { name: "Aklan", region: "Region VI" },
        { name: "Antique", region: "Region VI" },
        { name: "Capiz", region: "Region VI" },
        { name: "Guimaras", region: "Region VI" },
        { name: "Iloilo", region: "Region VI" },
        { name: "Negros Occidental", region: "Region VI" },
        
        // Region VII - Central Visayas
        { name: "Bohol", region: "Region VII" },
        { name: "Cebu", region: "Region VII" },
        { name: "Negros Oriental", region: "Region VII" },
        { name: "Siquijor", region: "Region VII" },
        
        // Region VIII - Eastern Visayas
        { name: "Biliran", region: "Region VIII" },
        { name: "Eastern Samar", region: "Region VIII" },
        { name: "Leyte", region: "Region VIII" },
        { name: "Northern Samar", region: "Region VIII" },
        { name: "Samar", region: "Region VIII" },
        { name: "Southern Leyte", region: "Region VIII" },
        
        // Region IX - Zamboanga Peninsula
        { name: "Zamboanga del Norte", region: "Region IX" },
        { name: "Zamboanga del Sur", region: "Region IX" },
        { name: "Zamboanga Sibugay", region: "Region IX" },
        
        // Region X - Northern Mindanao
        { name: "Bukidnon", region: "Region X" },
        { name: "Camiguin", region: "Region X" },
        { name: "Lanao del Norte", region: "Region X" },
        { name: "Misamis Occidental", region: "Region X" },
        { name: "Misamis Oriental", region: "Region X" },
        
        // Region XI - Davao Region
        { name: "Davao de Oro", region: "Region XI" },
        { name: "Davao del Norte", region: "Region XI" },
        { name: "Davao del Sur", region: "Region XI" },
        { name: "Davao Occidental", region: "Region XI" },
        { name: "Davao Oriental", region: "Region XI" },
        
        // Region XII - SOCCSKSARGEN
        { name: "Cotabato", region: "Region XII" },
        { name: "Sarangani", region: "Region XII" },
        { name: "South Cotabato", region: "Region XII" },
        { name: "Sultan Kudarat", region: "Region XII" },
        
        // Region XIII - Caraga
        { name: "Agusan del Norte", region: "Region XIII" },
        { name: "Agusan del Sur", region: "Region XIII" },
        { name: "Dinagat Islands", region: "Region XIII" },
        { name: "Surigao del Norte", region: "Region XIII" },
        { name: "Surigao del Sur", region: "Region XIII" },
        
        // BARMM - Bangsamoro Autonomous Region
        { name: "Basilan", region: "BARMM" },
        { name: "Lanao del Sur", region: "BARMM" },
        { name: "Maguindanao", region: "BARMM" },
        { name: "Sulu", region: "BARMM" },
        { name: "Tawi-Tawi", region: "BARMM" },
        
        // CAR - Cordillera Administrative Region
        { name: "Abra", region: "CAR" },
        { name: "Apayao", region: "CAR" },
        { name: "Benguet", region: "CAR" },
        { name: "Ifugao", region: "CAR" },
        { name: "Kalinga", region: "CAR" },
        { name: "Mountain Province", region: "CAR" }
    ],
    
    cities: {
        "Metro Manila": [
            "Caloocan City", "Las Piñas City", "Makati City", "Malabon City",
            "Mandaluyong City", "Manila", "Marikina City", "Muntinlupa City",
            "Navotas City", "Parañaque City", "Pasay City", "Pasig City",
            "Quezon City", "San Juan City", "Taguig City", "Valenzuela City",
            "Pateros"
        ],
        "Ilocos Norte": [
            "Batac City", "Laoag City", "Adams", "Bacarra", "Badoc", "Bangui",
            "Banna", "Burgos", "Carasi", "Currimao", "Dingras", "Dumalneg",
            "Marcos", "Nueva Era", "Pagudpud", "Paoay", "Pasuquin", "Piddig",
            "Pinili", "San Nicolas", "Sarrat", "Solsona", "Vintar"
        ],
        "Ilocos Sur": [
            "Candon City", "Vigan City", "Alilem", "Banayoyo", "Bantay", "Burgos",
            "Cabugao", "Caoayan", "Cervantes", "Galimuyod", "Gregorio del Pilar",
            "Lidlidda", "Magsingal", "Nagbukel", "Narvacan", "Quirino", "Salcedo",
            "San Emilio", "San Esteban", "San Ildefonso", "San Juan", "San Vicente",
            "Santa", "Santa Catalina", "Santa Cruz", "Santa Lucia", "Santa Maria",
            "Santiago", "Santo Domingo", "Sigay", "Sinait", "Sugpon", "Suyo", "Tagudin"
        ],
        "La Union": [
            "San Fernando City", "Agoo", "Aringay", "Bacnotan", "Bagulin", "Balaoan",
            "Bangar", "Bauang", "Burgos", "Caba", "Luna", "Naguilian", "Pugo",
            "Rosario", "San Gabriel", "San Juan", "Santo Tomas", "Santol", "Sudipen", "Tubao"
        ],
        "Pangasinan": [
            "Alaminos City", "Dagupan City", "San Carlos City", "Urdaneta City",
            "Agno", "Aguilar", "Alcala", "Anda", "Asingan", "Balungao", "Bani",
            "Basista", "Bautista", "Bayambang", "Binalonan", "Binmaley", "Bolinao",
            "Bugallon", "Burgos", "Calasiao", "Dasol", "Infanta", "Labrador",
            "Laoac", "Lingayen", "Mabini", "Malasiqui", "Manaoag", "Mangaldan",
            "Mangatarem", "Mapandan", "Natividad", "Pozorrubio", "Rosales",
            "San Fabian", "San Jacinto", "San Manuel", "San Nicolas", "San Quintin",
            "Santa Barbara", "Santa Maria", "Santo Tomas", "Sison", "Sual",
            "Tayug", "Umingan", "Urbiztondo", "Villasis"
        ],
        "Cavite": [
            "Bacoor City", "Cavite City", "Dasmariñas City", "General Trias City",
            "Imus City", "Tagaytay City", "Trece Martires City", "Alfonso", "Amadeo",
            "Carmona", "General Emilio Aguinaldo", "Indang", "Kawit", "Magallanes",
            "Maragondon", "Mendez", "Naic", "Noveleta", "Rosario", "Silang",
            "Tanza", "Ternate"
        ],
        "Laguna": [
            "Biñan City", "Calamba City", "Cabuyao City", "San Pablo City",
            "San Pedro City", "Santa Rosa City", "Alaminos", "Bay", "Calauan",
            "Cavinti", "Famy", "Kalayaan", "Liliw", "Los Baños", "Luisiana",
            "Lumban", "Mabitac", "Magdalena", "Majayjay", "Nagcarlan", "Paete",
            "Pagsanjan", "Pakil", "Pangil", "Pila", "Rizal", "San Pedro",
            "Santa Cruz", "Santa Maria", "Siniloan", "Victoria"
        ],
        "Batangas": [
            "Batangas City", "Lipa City", "Tanauan City", "Agoncillo", "Alitagtag",
            "Balayan", "Balete", "Bauan", "Calaca", "Calatagan", "Cuenca", "Ibaan",
            "Laurel", "Lemery", "Lian", "Lobo", "Mabini", "Malvar", "Mataas na Kahoy",
            "Nasugbu", "Padre Garcia", "Rosario", "San Jose", "San Juan", "San Luis",
            "San Nicolas", "San Pascual", "Santa Teresita", "Santo Tomas", "Taal",
            "Talisay", "Taysan", "Tingloy", "Tuy"
        ],
        "Rizal": [
            "Antipolo City", "Angono", "Baras", "Binangonan", "Cainta", "Cardona",
            "Jalajala", "Morong", "Pililla", "Rodriguez", "San Mateo", "Tanay", "Taytay", "Teresa"
        ],
        "Quezon": [
            "Lucena City", "Tayabas City", "Agdangan", "Alabat", "Atimonan", "Buenavista",
            "Burdeos", "Calauag", "Candelaria", "Catanauan", "Dolores", "General Luna",
            "General Nakar", "Guinayangan", "Gumaca", "Infanta", "Jomalig", "Lopez",
            "Lucban", "Macalelon", "Mauban", "Mulanay", "Padre Burgos", "Pagbilao",
            "Panukulan", "Patnanungan", "Perez", "Pitogo", "Plaridel", "Polillo",
            "Quezon", "Real", "Sampaloc", "San Andres", "San Antonio", "San Francisco",
            "San Narciso", "Sariaya", "Tagkawayan", "Tiaong", "Unisan"
        ],
        "Bulacan": [
            "Malolos City", "Meycauayan City", "San Jose del Monte City", "Angat",
            "Balagtas", "Baliuag", "Bocaue", "Bulakan", "Bustos", "Calumpit",
            "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Marilao", "Norzagaray",
            "Obando", "Pandi", "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
            "San Miguel", "San Rafael", "Santa Maria"
        ],
        "Pampanga": [
            "Angeles City", "Mabalacat City", "San Fernando City", "Apalit", "Arayat",
            "Bacolor", "Candaba", "Floridablanca", "Guagua", "Lubao", "Macabebe",
            "Magalang", "Masantol", "Mexico", "Minalin", "Porac", "San Luis",
            "San Simon", "Santa Ana", "Santa Rita", "Santo Tomas", "Sasmuan"
        ],
        "Cebu": [
            "Cebu City", "Danao City", "Lapu-Lapu City", "Mandaue City", "Naga City",
            "Talisay City", "Toledo City", "Alcantara", "Alcoy", "Alegria", "Aloguinsan",
            "Argao", "Asturias", "Badian", "Balamban", "Bantayan", "Barili", "Bogo City",
            "Boljoon", "Borbon", "Carcar City", "Carmen", "Catmon", "Compostela",
            "Consolacion", "Cordova", "Daanbantayan", "Dalaguete", "Dumanjug",
            "Ginatilan", "Liloan", "Madridejos", "Malabuyoc", "Medellin", "Minglanilla",
            "Moalboal", "Oslob", "Pilar", "Pinamungajan", "Poro", "Ronda", "Samboan",
            "San Fernando", "San Francisco", "San Remigio", "Santa Fe", "Santander",
            "Sibonga", "Sogod", "Tabogon", "Tabuelan", "Tuburan", "Tudela"
        ],
        "Davao del Sur": [
            "Davao City", "Digos City", "Bansalan", "Hagonoy", "Kiblawan", "Magsaysay",
            "Malalag", "Matanao", "Padada", "Santa Cruz", "Sulop"
        ],
        "Lanao del Norte": [
            "Iligan City", "Bacolod", "Baloi", "Baroy", "Kapatagan", "Kauswagan",
            "Kolambugan", "Lala", "Linamon", "Magsaysay", "Maigo", "Matungao",
            "Munai", "Nunungan", "Pantao Ragat", "Pantar", "Poona Piagapo",
            "Salvador", "Sapad", "Sultan Naga Dimaporo", "Tagoloan", "Tangcal", "Tubod"
        ]
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = philippineLocations;
}
