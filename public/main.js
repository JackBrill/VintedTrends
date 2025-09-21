// Enhanced main.js - With smart filter switching
class VintedDashboard {
  constructor() {
    this.salesContainer = document.getElementById("salesContainer");
    this.loadingState = document.getElementById("loadingState");
    this.searchBar = document.getElementById("searchBar");
    this.resetFiltersBtn = document.getElementById("resetFiltersBtn");
    this.statsDisplay = document.getElementById("statsDisplay");
    this.activeFiltersContainer = document.getElementById('activeFiltersContainer');
    
    this.sortBtn = document.getElementById('sortBtn');
    this.sortBtnText = document.getElementById('sortBtnText');
    this.sortDropdown = document.getElementById('sortDropdown');

    // State
    this.allSales = [];
    this.currentSort = 'newest';
    this.searchQuery = '';
    this.currentFilters = { brand: [], color: [], size: [] };
    this.lastUpdateTime = null;
    this.filterOptions = { brand: [], color: [], size: [] };
    this.activeDropdown = null; // Track the currently open filter dropdown
    
    this.init();
  }

  // Helper Functions
  getSaleSpeed(item) {
    if (item.startedAt && item.soldAt) {
      const startTime = new Date(item.startedAt);
      const soldTime = new Date(item.soldAt);
      const diffMs = soldTime - startTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      return `${diffMins}m ${diffSecs}s`;
    }
    return null;
  }

  getSaleDurationInMs(item) {
    return (item.startedAt && item.soldAt) 
      ? new Date(item.soldAt) - new Date(item.startedAt) 
      : Infinity;
  }

  extractSize(subtitle) {
    return subtitle ? (subtitle.split('·')[0].trim().toUpperCase() || null) : null;
  }

  /**
   * UPDATED: More intelligent brand extraction logic.
   */
  extractBrand(item) {
    // 1. Define a list of known brands to check against first.
    // List longer names before shorter ones (e.g., 'Polo Ralph Lauren' before 'Ralph Lauren').
    const KNOWN_BRANDS = [
      'The North Face', 'Dr. Martens', 'New Balance', 'Stone Island',
      'Carhartt WIP', 'Polo Ralph Lauren', 'Ralph Lauren', 'Calvin Klein',
      'Tommy Hilfiger', 'Levi\'s', 'Stussy'
      // You can easily add more multi-word brands to this list
    ];

    // 2. Check if the item name starts with any known brand (most accurate method).
    if (item.name) {
      const nameLower = item.name.toLowerCase();
      for (const brand of KNOWN_BRANDS) {
        if (nameLower.startsWith(brand.toLowerCase())) {
          return brand; // Return the correctly cased brand name
        }
      }
    }

    // 3. If no known brand is found, try to extract from the subtitle.
    if (item.subtitle) {
      const parts = item.subtitle.split('·');
      if (parts.length > 1 && parts[1]) {
        const brandCandidate = parts[1].trim();
        const conditionBlacklist = ['new with tags', 'new without tags', 'very good', 'good', 'satisfactory'];
        if (!conditionBlacklist.includes(brandCandidate.toLowerCase())) {
          return brandCandidate;
        }
      }
    }

    // 4. As a last resort, fall back to the first word of the name.
    if (item.name) {
      return item.name.split(' ')[0];
    }

    return null;
  }

  mapColorNameToHex(colorName) {
    if (!colorName) return null;
    const firstColor = colorName.split(',')[0].trim().toLowerCase();
    const colorMap = {'black': '#000000', 'white': '#FFFFFF', 'grey': '#808080','gray': '#808080', 'silver': '#C0C0C0', 'red': '#FF0000','maroon': '#800000', 'orange': '#FFA500', 'yellow': '#FFFF00','olive': '#808000', 'lime': '#00FF00', 'green': '#008000','aqua': '#00FFFF', 'cyan': '#00FFFF', 'teal': '#008080','blue': '#0000FF', 'navy': '#000080', 'fuchsia': '#FF00FF','magenta': '#FF00FF', 'purple': '#800080', 'pink': '#FFC0CB','brown': '#A52A2A', 'beige': '#F5F5DC', 'khaki': '#F0E68C','gold': '#FFD700', 'cream': '#FFFDD0', 'burgundy': '#800020','mustard': '#FFDB58', 'turquoise': '#40E0D0', 'indigo': '#4B0082','violet': '#EE82EE', 'plum': '#DDA0DD', 'orchid': '#DA70D6','salmon': '#FA8072', 'coral': '#FF7F50', 'chocolate': '#D2691E','tan': '#D2B48C', 'ivory': '#FFFFF0', 'honeydew': '#F0FFF0','azure': '#F0FFFF', 'lavender': '#E6E6FA', 'rose': '#FFE4E1','lilac': '#C8A2C8', 'mint': '#98FF98', 'peach': '#FFDAB9','sky blue': '#87CEEB', 'royal blue': '#4169E1', 'cobalt': '#0047AB','denim': '#1560BD', 'emerald': '#50C878', 'mint green': '#98FF98','lime green': '#32CD32', 'forest green': '#228B22', 'olive green': '#6B8E23','mustard yellow': '#FFDB58', 'lemon': '#FFFACD', 'coral pink': '#F88379','hot pink': '#FF69B4', 'baby pink': '#F4C2C2', 'ruby': '#E0115F','scarlet': '#FF2400', 'wine': '#722F37', 'terracotta': '#E2725B','bronze': '#CD7F32', 'light blue': '#ADD8E6', 'dark green': '#006400','light grey': '#D3D3D3', 'dark blue': '#00008B', 'light green': '#90EE90','dark grey': '#A9A9A9', 'multicolour': '#CCCCCC', 'check': '#A9A9A9','floral': '#A9A9A9', 'animal print': '#A9A9A9', 'striped': '#A9A9A9','camouflage': '#A9A9A9', 'geometric': '#A9A9A9', 'abstract': '#A9A9A9'};
    return colorMap[firstColor] || '#CCCCCC';
  }

  updateStats(filteredSales) {
    if (!this.statsDisplay) return;
    if (filteredSales.length === 0) {
      this.statsDisplay.textContent = 'No items match filters';
      return;
    }
    const validSaleTimes = filteredSales.map(item => this.getSaleDurationInMs(item)).filter(time => time !== Infinity);
    const avgSaleTime = validSaleTimes.length > 0 ? validSaleTimes.reduce((sum, time) => sum + time, 0) / validSaleTimes.length : 0;
    const avgSaleTimeFormatted = avgSaleTime > 0 ? `${Math.floor(avgSaleTime / 60000)}m ${Math.floor((avgSaleTime % 60000) / 1000)}s` : 'N/A';
    const prices = filteredSales.map(item => parseFloat(item.price.replace(/[^0-9.-]+/g, "") || "0")).filter(price => price > 0);
    const avgPrice = prices.length > 0 ? (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2) : 0;
    const fastestSale = Math.min(...validSaleTimes);
    const fastestFormatted = fastestSale !== Infinity ? `${Math.floor(fastestSale / 60000)}m ${Math.floor((fastestSale % 60000) / 1000)}s` : 'N/A';
    this.statsDisplay.innerHTML = `<span class="font-semibold">${filteredSales.length}</span> items • Avg: <span class="font-semibold">${avgSaleTimeFormatted}</span> • Fastest: <span class="font-semibold text-primary">${fastestFormatted}</span> • Avg Price: <span class="font-semibold">£${avgPrice}</span>`;
  }

  renderSales() {
    this.loadingState.classList.add('hidden');
    this.salesContainer.classList.remove('hidden');

    if (!this.allSales || this.allSales.length === 0) {
        this.salesContainer.innerHTML = `<div class="col-span-full text-center py-12"><h2 class="text-xl font-semibold text-muted-foreground">No sold items recorded yet.</h2><p class="text-muted-foreground">The tracker is running. Sold items will appear here automatically.</p></div>`;
        return;
    }

    const filteredSales = this.getFilteredSales();
    this.renderActiveFilters();
    this.populateFilters();
    const sortedSales = this.sortSales(filteredSales);
    this.updateStats(sortedSales);

    if (sortedSales.length === 0) {
        this.salesContainer.innerHTML = `<p class="col-span-full text-center text-muted-foreground py-12">No items match your filters.</p>`;
        return;
    }

    this.salesContainer.innerHTML = sortedSales.map(item => {
        const saleSpeed = this.getSaleSpeed(item);
        const size = this.extractSize(item.subtitle);
        const colorHex = this.mapColorNameToHex(item.color_name);
        const soldTimeAgo = (() => { if (!item.soldAt) return ''; const seconds = Math.round((new Date() - new Date(item.soldAt)) / 1000); const minutes = Math.round(seconds / 60); const hours = Math.round(minutes / 60); const days = Math.round(hours / 24); if (seconds < 60) return `${seconds}s ago`; if (minutes < 60) return `${minutes}m ago`; if (hours < 24) return `${hours}h ago`; return `${days}d ago`; })();
        const colorCircleHTML = colorHex ? `<div class="w-4 h-4 rounded-full ${colorHex.toUpperCase() === '#FFFFFF' ? 'border' : ''}" style="background-color: ${colorHex};" title="${item.color_name || 'Color'}"></div>` : '';
        const sizeAndColorHTML = size || colorCircleHTML ? `<div class="flex items-center gap-1.5 flex-shrink-0">${size ? `<span class="text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">${size}</span>` : ''}${colorCircleHTML}</div>` : '';
        return `<div class="bg-card text-card-foreground border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col"><a href="${item.link}" target="_blank" rel="noopener noreferrer" class="block relative group"><img src="${item.image || 'https://placehold.co/400x600/f1f5f9/94a3b8?text=Sold'}" alt="${item.name || 'Sold item'}" class="w-full aspect-[3/4] object-cover group-hover:opacity-90 transition-opacity" loading="lazy" onerror="this.src='https://placehold.co/400x600/f1f5f9/94a3b8?text=No+Image'" /></a><div class="p-3 flex flex-col flex-grow"><div class="flex justify-between items-start gap-2 mb-2"><p class="font-semibold text-sm line-clamp-2 leading-tight">${item.name || 'Untitled Item'}</p>${sizeAndColorHTML}</div><div class="flex justify-between items-center text-xs text-muted-foreground mb-2"><span class="truncate">${saleSpeed ? `Sold in: ${saleSpeed}` : ''}</span><span class="flex-shrink-0 ml-2">${soldTimeAgo}</span></div><div class="flex-grow"></div><p class="text-lg font-bold text-primary mb-3">${item.price || ''}</p><a href="${item.link}" target="_blank" rel="noopener noreferrer" class="block text-center w-full bg-transparent border border-primary text-primary font-bold py-2 px-4 rounded-md hover:bg-primary hover:text-primary-foreground transition-all duration-200 text-sm">View on Vinted</a></div></div>`;
    }).join("");
  }

  renderActiveFilters() {
    this.activeFiltersContainer.innerHTML = '';
    Object.entries(this.currentFilters).forEach(([type, values]) => {
        values.forEach(value => {
            const tag = document.createElement('div');
            tag.className = 'flex items-center gap-2 bg-primary/10 text-primary-hover font-semibold text-sm px-3 py-1 rounded-full';
            tag.innerHTML = `<span>${value}</span><button class="remove-filter-btn" data-filter-type="${type}" data-filter-value="${value}"><svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>`;
            this.activeFiltersContainer.appendChild(tag);
        });
    });
  }

  getFilteredSales(ignoreFilterType = null) {
    const query = this.searchQuery.toLowerCase();
    return this.allSales.filter(item => {
        const searchMatch = !query || (item.name && item.name.toLowerCase().includes(query)) || (item.link && item.link.toLowerCase().includes(query)) || (item.subtitle && item.subtitle.toLowerCase().includes(query));
        if (!searchMatch) return false;
        const brand = this.extractBrand(item);
        const size = this.extractSize(item.subtitle);
        const color = item.color_name ? item.color_name.split(',')[0].trim() : null;
        const brandMatch = ignoreFilterType === 'brand' || this.currentFilters.brand.length === 0 || (brand && this.currentFilters.brand.includes(brand));
        const colorMatch = ignoreFilterType === 'color' || this.currentFilters.color.length === 0 || (color && this.currentFilters.color.includes(color));
        const sizeMatch = ignoreFilterType === 'size' || this.currentFilters.size.length === 0 || (size && this.currentFilters.size.includes(size));
        return brandMatch && colorMatch && sizeMatch;
    });
  }
  
  populateFilters() {
    const itemsForBrandFilter = this.getFilteredSales('brand');
    const itemsForColorFilter = this.getFilteredSales('color');
    const itemsForSizeFilter = this.getFilteredSales('size');
    const brandCounts = new Map();
    itemsForBrandFilter.forEach(item => { const brand = this.extractBrand(item); if (brand) brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1); });
    const colorCounts = new Map();
    itemsForColorFilter.forEach(item => { const color = item.color_name ? item.color_name.split(',')[0].trim() : null; if (color) colorCounts.set(color, (colorCounts.get(color) || 0) + 1); });
    const sizeCounts = new Map();
    itemsForSizeFilter.forEach(item => { const size = this.extractSize(item.subtitle); if (size) sizeCounts.set(size, (sizeCounts.get(size) || 0) + 1); });
    this.filterOptions.brand = [...brandCounts.entries()].sort(([, a], [, b]) => b - a).map(([v, c]) => ({ value: v, count: c }));
    this.filterOptions.color = [...colorCounts.entries()].sort(([, a], [, b]) => b - a).map(([v, c]) => ({ value: v, count: c }));
    this.filterOptions.size = this.sortSizes([...sizeCounts.entries()].map(([v, c]) => ({ value: v, count: c })));
    this.updateFilterDropdown('brand', this.filterOptions.brand);
    this.updateFilterDropdown('color', this.filterOptions.color);
    this.updateFilterDropdown('size', this.filterOptions.size);
  }

  updateFilterDropdown(filterType, options) {
    const list = document.getElementById(`${filterType}FilterList`);
    if (!list) return;
    const createCheckbox = (name, option) => {
      const value = typeof option === 'object' ? option.value : option;
      const label = typeof option === 'object' ? `${option.value} (${option.count})` : option;
      const isChecked = this.currentFilters[name].includes(value);
      return `<label class="flex items-center w-full p-1.5 rounded hover:bg-muted cursor-pointer"><input type="checkbox" name="${name}" value="${value}" ${isChecked ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"><span class="ml-2 text-sm text-gray-800 truncate">${label}</span></label>`;
    };
    list.innerHTML = options.map(option => createCheckbox(filterType, option)).join('');
  }

  sortSales(sales) {
    return [...sales].sort((a, b) => {
        switch (this.currentSort) {
          case 'time_asc': return this.getSaleDurationInMs(a) - this.getSaleDurationInMs(b);
          case 'price_asc': return parseFloat(a.price.replace(/[^0-9.-]+/g, "") || "0") - parseFloat(b.price.replace(/[^0-9.-]+/g, "") || "0");
          case 'price_desc': return parseFloat(b.price.replace(/[^0-9.-]+/g, "") || "0") - parseFloat(a.price.replace(/[^0-9.-]+/g, "") || "0");
          default: return new Date(b.soldAt || 0) - new Date(a.soldAt || 0);
        }
    });
  }

  sortSizes(sizes) {
    const sizeOrder = {'XXS': 1, 'XS': 2, 'S': 3, 'M': 4, 'L': 5, 'XL': 6, 'XXL': 7, '2XL': 7, 'XXXL': 8, '3XL': 8, 'XXXXL': 9, '4XL': 9, '5XL': 10 };
    return sizes.sort((a, b) => {
      const aUpper = a.value.toUpperCase(), bUpper = b.value.toUpperCase();
      const aIsOrdered = sizeOrder[aUpper], bIsOrdered = sizeOrder[bUpper];
      const aIsNumeric = !isNaN(parseFloat(a.value)) && isFinite(a.value), bIsNumeric = !isNaN(parseFloat(b.value)) && isFinite(b.value);
      if (aIsOrdered && bIsOrdered) return sizeOrder[aUpper] - sizeOrder[bUpper];
      if (aIsNumeric && bIsNumeric) return parseFloat(a.value) - parseFloat(b.value);
      if (aIsOrdered && !bIsOrdered) return -1;
      if (!aIsOrdered && bIsOrdered) return 1;
      if (aIsNumeric && !bIsNumeric) return -1;
      if (!aIsNumeric && bIsNumeric) return 1;
      return a.value.localeCompare(b.value);
    });
  }

  async fetchSales() {
    let apiUrl = "/api/sales"; // Default for homepage (all data)
    const path = window.location.pathname;

    // Checks the browser's URL to decide which category to request
    if (path.startsWith('/mens')) {
        apiUrl = "/api/sales?category=mens";
    } else if (path.startsWith('/womens')) {
        apiUrl = "/api/sales?category=womens";
    } else if (path.startsWith('/shoes')) {
        apiUrl = "/api/sales?category=shoes";
    } else if (path.startsWith('/designer')) {
        apiUrl = "/api/sales?category=designer";
    }

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const salesData = await res.json();
      this.allSales = salesData;
      this.lastUpdateTime = new Date();
      this.renderSales();
    } catch (err) {
      console.error("Failed to fetch sales:", err);
      this.salesContainer.innerHTML = `<div class="col-span-full text-center py-12 text-red-600"><h2 class="text-xl font-semibold mb-2">Error loading sales data</h2><p class="text-sm text-muted-foreground">Check console for details. Make sure the server is running.</p></div>`;
    }
  }

  applyFilter(filterType) {
    if (!filterType) return;
    const dropdown = document.getElementById(`${filterType}FilterDropdown`);
    dropdown.classList.add('hidden');
    this.activeDropdown = null;
    this.renderSales();
  }

  updateFilterButtonUI(filterType) {
    const btnText = document.getElementById(`${filterType}FilterBtnText`);
    const btn = document.getElementById(`${filterType}FilterBtn`);
    const count = this.currentFilters[filterType].length;
    btnText.textContent = `${filterType.charAt(0).toUpperCase() + filterType.slice(1)}${count > 0 ? ` (${count})` : ''}`;
    btn.classList.toggle('filter-btn-active', count > 0);
  }

  setupEventListeners() {
    this.searchBar.addEventListener('input', e => { this.searchQuery = e.target.value; this.renderSales(); });
    this.resetFiltersBtn.addEventListener('click', () => { window.location.reload(); });
    ['brand', 'color', 'size'].forEach(filterType => this.setupFilter(filterType));
    
    // Sort Dropdown
    if (this.sortBtn) {
        const sortOptionsMap = { 'newest': 'Sort: Most Recent', 'time_asc': 'Sort: Fastest Sale', 'price_asc': 'Sort: Price Low-High', 'price_desc': 'Sort: Price High-Low' };
        this.sortBtn.addEventListener('click', e => { e.stopPropagation(); this.activeDropdown = null; document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.add('hidden')); this.sortDropdown.classList.toggle('hidden'); });
        this.sortDropdown.addEventListener('click', e => {
            e.preventDefault();
            const target = e.target.closest('.sort-option');
            if (target) {
                this.currentSort = target.dataset.value;
                this.sortBtnText.textContent = sortOptionsMap[this.currentSort];
                this.sortDropdown.classList.add('hidden');
                this.renderSales();
            }
        });
    }

    // Event listener for removing active filter tags
    this.activeFiltersContainer.addEventListener('click', e => {
        const removeBtn = e.target.closest('.remove-filter-btn');
        if (removeBtn) {
            const { filterType, filterValue } = removeBtn.dataset;
            this.currentFilters[filterType] = this.currentFilters[filterType].filter(val => val !== filterValue);
            this.updateFilterButtonUI(filterType);
            this.renderSales();
        }
    });

    // Global click listener to close dropdowns AND APPLY FILTERS
    window.addEventListener('click', () => {
      if (this.activeDropdown) {
          this.applyFilter(this.activeDropdown);
      }
      document.querySelectorAll('.filter-dropdown, #sortDropdown').forEach(d => d.classList.add('hidden'));
    });
    document.querySelectorAll('.filter-dropdown, #sortDropdown').forEach(d => {
      d.addEventListener('click', e => e.stopPropagation());
    });
  }

  setupFilter(filterType) {
    const btn = document.getElementById(`${filterType}FilterBtn`);
    const dropdown = document.getElementById(`${filterType}FilterDropdown`);
    const applyBtn = document.getElementById(`apply${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Filter`);
    const searchInput = document.getElementById(`${filterType}Search`);
    const list = document.getElementById(`${filterType}FilterList`);
    if (!btn || !dropdown || !applyBtn || !searchInput || !list) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (this.activeDropdown && this.activeDropdown !== filterType) {
        this.applyFilter(this.activeDropdown);
      }
      document.querySelectorAll('.filter-dropdown, #sortDropdown').forEach(d => { if (d !== dropdown) d.classList.add('hidden'); });
      dropdown.classList.toggle('hidden');
      if (!dropdown.classList.contains('hidden')) {
          this.activeDropdown = filterType;
          this.updateFilterDropdown(filterType, this.filterOptions[filterType]);
          searchInput.focus();
      } else {
          this.applyFilter(this.activeDropdown);
      }
    });

    searchInput.addEventListener('input', () => {
      const term = searchInput.value.toLowerCase();
      const filtered = this.filterOptions[filterType].filter(option => (typeof option === 'object' ? option.value : option).toLowerCase().includes(term));
      this.updateFilterDropdown(filterType, filtered);
    });

    list.addEventListener('change', e => {
        if (e.target.type === 'checkbox') {
            const checkedInputs = list.querySelectorAll('input[type="checkbox"]:checked');
            this.currentFilters[filterType] = Array.from(checkedInputs).map(input => input.value);
            this.renderActiveFilters();
            this.updateFilterButtonUI(filterType);
        }
    });

    applyBtn.addEventListener('click', () => {
      this.applyFilter(filterType);
    });
  }

  init() {
    this.setupEventListeners();
    this.fetchSales();
    setInterval(() => { this.fetchSales(); }, 30000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.vintedDashboard = new VintedDashboard();
});
